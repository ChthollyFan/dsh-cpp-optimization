# 四、性能与内存

核心判断：**这个开销是否可测量、是否在热点路径上、优化后是否真的更快**。没有剖析数据就不下结论；每轮只改一处并复测。性能手段不得改变业务语义、时间精度或排序稳定性。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 热点循环内 `new`/`delete` | 每次分配都含锁、元数据、堆管理和碎片成本 | 逐次 `new Node`/`delete node` → 批量预分配 + 空闲链表复用（`std::pmr`） | 17+（`pmr`） |
| 池化之前先验证分配确实是热点 | 池管理开销可能大于分配本身；分配不频繁、生命周期差异大、超过 64 KB 的大对象不应池化 | 直接手写池 → 先用 perf/火焰图确认 `malloc`/`_int_free` 是热点，或先替换 tcmalloc/mimalloc | 11+ |
| 跨线程高频写计数器按缓存行隔离 | 同一缓存行跨核写触发 MESI 反复失效，并行写被串行化 | `std::atomic<int> c[N];` → `struct alignas(64) Counter { std::atomic<int> n; };` | 11+（`hardware_destructive_interference_size` 需 17） |
| 结构体字段按大小降序排列 | 对齐填充会放大对象，缓存行能容纳的对象数下降 | `{char a; double b; char c; int d;}` → `{double b; int d; char a; char c;}` | 11+ |
| 空类不要作为成员，作为基类可享受 EBO | 空类作为独立对象或成员都至少占 1 字节并参与对齐，EBO 只对基类生效 | `struct H { Empty e; int x; };` → `struct O : Empty { int x; };` | 11+ |
| 空成员可用 `[[no_unique_address]]` 把 EBO 延伸到成员位置 | 该属性只是「允许」非强制，编译器可以忽略 | `Empty e;` → `[[no_unique_address]] Empty e;` | 20+（C++17 降级：改为继承空类） |
| 多态空基类不要再指望 EBO，少用虚继承与多继承 | vptr 使 EBO 失效；虚继承多一个 vbtable 指针与一次间接寻址，多继承多 vptr 与 `this` 调整 thunk | `class Mid : virtual public Base {};` → 改单继承或组合 | 11+ |
| 能编译期求值的不要留到运行期 | 运行期重复计算，热点上无收益 | `int n = square(10);` → `constexpr int n = square(10);` | 11+ |
| 剖析必须用优化构建 + 调试符号 + 帧指针 | `-O0` 下热点分布失真，无 `-g` 只有裸地址，省帧指针会让调用栈塌成一条线 | `g++ -O0 x.cpp` → `g++ -O2 -g -fno-omit-frame-pointer x.cpp` | 11+ |
| 先测量再动手，一轮只改一处 | `-O2` 的去虚化与内联会改写热点分布（实测虚调用仅约 8%、`unordered_map` 占 41%）；一次改多处分不清效果 | 直接优化虚函数 → 先 `perf stat`/`report`/`annotate` 定位到行，每轮只改最热的一处并复测 | 11+ |
| 循环要满足向量化条件 | 需次数已知、无循环依赖、无指针别名、无分支，否则编译器保守不向量化 | `a[i] = b[i] + 1;`（`a`、`b` 可能重叠） → 加 `__restrict`（GCC/Clang `__restrict__`、MSVC `__restrict`），或改写消除依赖 | 非标准扩展（注意是否 `-std=gnu++NN`） |
| 必须验证是否真的向量化了 | 只看源码无法确认生成了 SIMD | `g++ -O2 -fopt-info-vec-optimized l.cpp`（Clang `-Rpass=loop-vectorize`），或 `-S` 反汇编查 `movaps`/`addps` | 11+ |
| 无序数据上的分支、强行 `inline` 大函数、容器不预分配 | 分支预测错误代价高；过度内联导致指令缓存 miss（经验上十几行以内才值得内联）；扩容带来隐藏分配与拷贝 | `if (x > 0) sum += x;` → `sum += x * (x > 0);`；大函数加 `inline` → 只内联小函数；循环 `push_back` → `v.reserve(n)`，只读字符串参数用 `std::string_view` | 11+（`string_view` 需 17） |

**本参考未覆盖**：内存越界/泄漏检测（ASan、Valgrind）、数据竞争检测（TSan）、`std::launder` 与对象生命周期细节、分配器 `rebind`/传播的具体写法、手写 intrinsics 的完整落地与跨平台分发。
