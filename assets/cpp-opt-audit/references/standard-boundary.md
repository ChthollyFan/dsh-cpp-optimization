# 八、标准边界（C++17 与 20/23 特性取舍）

核心判断：**这条建议需要哪个标准、目标工程是否满足、不满足时的等价写法是什么**。这是审查中最容易出错的一类：给出正确但编不过的建议。先用 [standard-detection.md](standard-detection.md) 确认工程标准，再逐条比对。

## 一、语言与库特性边界

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| `optional` 取值前必须判空 | `*o` 在无值时是 UB，`value()` 抛 `bad_optional_access` | `*o;` → `o.value_or(0)` 或先 `if (o)` | 17+ |
| 可能无值的返回值用 `optional` | 哨兵值可能恰好是合法值，输出参数语义弱 | `return -1;` → `return std::nullopt;` | 17+ |
| `optional` 链式 `and_then`/`transform` | 需要 C++23；C++17 只能层层判空 | `if (o) { ... }` → `o.transform(f).or_else(g)` | 23+（17 降级：手写判空） |
| `variant`/`any` 取值前校验类型 | 类型不匹配会抛 `bad_variant_access`/`bad_any_cast` | `std::get<int>(v)` → 先 `std::holds_alternative<int>(v)`，或用 `std::visit` | 17+ |
| `union` 读错类型是 UB，改用 `variant` | `variant` 内部记录当前类型并自动构造/析构 | `union { int i; float f; } u;` → `std::variant<int, float> v;` | 17+ |
| 视图不得悬垂 | 视图不拥有数据，其生命周期必须长于视图 | `return local;`（返回视图） → `return std::string(local);` | 17+ |
| `string_view` 传给 C 接口前先转 `std::string` | `data()` 在 C++17 不保证 `'\0'` 结尾（C++20 的 `c_str` 才有保证） | `c_func(sv.data());` → `std::string t(sv); c_func(t.c_str());` | 17+ |
| 只读字符串参数用 `string_view` | `const std::string&` 接字面量会隐式构造临时 `string` | `void f(const std::string&);` → `void f(std::string_view);` | 17+ |
| 只读连续内存用 `span<const T>` | `std::span` 需要 C++20；C++17 只能用指针 + 长度 | `std::span<const int>` | 20+（17 降级：`const T* data, std::size_t count`） |
| 测耗时用 `steady_clock`，跨单位显式 `duration_cast` | `system_clock` 会被 NTP 调整；不同 `duration` 单位不隐式转换 | `system_clock::now()` → `steady_clock::now()` | 11+ |
| 格式化用 `std::format`/`std::print` | 类型安全且接近 `printf` 的表达力 | `printf("%d", x);` → `std::format("{}", x);` | 20+/23+（17 降级：`printf` 风格或 fmt 库） |
| 位重解释用 `bit_cast`；移位必须用无符号且不越位宽 | `*(uint32_t*)&f` 违反严格别名规则 | `*(uint32_t*)&f` → `std::bit_cast<uint32_t>(f)` | 20+（17 降级：`memcpy`） |
| 随机数用 `mt19937` + 分布器，引擎只建一次 | `rand() % N` 有偏且非线程安全；种子用 `random_device` | `rand() % 100;` → `std::uniform_int_distribution<>(0, 99)(gen)` | 11+ |
| 多值返回用命名 `struct`；用结构化绑定时绑定引用写 `auto&` | `tuple` 靠位置记忆，重排顺序就全错；默认绑定是拷贝 | `auto [a, b] = f();` → `const auto& [a, b] = f();` | 17+ |
| `constexpr` 只标编译期可求值的 | 运行期值会编译错误；C++20 起 `vector` 才可用于 `constexpr` 上下文 | `constexpr int x = runtime();` → `const int x = runtime();` | 11+（`constexpr` 容器需 20） |
| concepts 约束模板形参 | 需要 C++20；C++17 用 `enable_if`/SFINAE | `template <Hashable T>` | 20+（17 降级：`enable_if_t`） |
| 三路比较 `<=>` 自动生成比较运算符 | 需要 C++20；C++17 需逐个手写六个比较运算符 | 手写 `operator<` → `auto operator<=>(const P&) const = default;` | 20+ |
| ranges 视图存活期间不得修改底层容器 | 视图引用原数据，改容器会导致失效；C++17 只能手写循环 | 视图存活时 `v.push_back(7);` → 先物化到 `vector` | 20+ |
| 协程句柄必须 `destroy`，`done` 之后不得 `resume` | 否则泄漏或 UB；C++17 无协程，只能降级为回调或状态机 | `~G() { handle.destroy(); }` | 20+ |
| 模块只 `export` 必要接口 | 模块不导出宏；C++17 只能头文件 + pimpl 隐藏实现 | 头文件裸声明 → `export int add(int, int);` | 20+ |
| `expected` 表达成功或失败 | 需要 C++23；C++17 降级为 `optional` 或 `variant<Value, Error>` | `std::variant<V, E>` → `std::expected<V, E>` | 23+（17 降级） |
| `filesystem` 用 `operator/` 拼路径，查错用带 `error_code` 的重载 | `+` 会丢分隔符；不带 `ec` 的版本会抛 `filesystem_error` | `p + "/x";` → `p / "x";` | 17+ |
| 自定义分配器需处理 `propagate_on_container_*` | 状态不传递则拷贝后指向不同池；PMR 是 C++17 | 用 `allocator_traits` 处理 `rebind` 与传播 | 11+（PMR 需 17） |
| 用 20/23 特性前先确认工程标准与编译器 | 高版本特性写进低标准工程直接编译不过，模块格式还不互通 | 先核对 `-std=c++17` 与目标位宽，再决定写法 | 全标准 |

## 二、C++20/23 深入机制的额外检查点

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 协程 `final_suspend` 必须返回 `suspend_always`，且句柄必须有人 `destroy` | 返回 `suspend_never` 会提前销毁帧；漏 `destroy` 即堆泄漏、句柄悬垂 UB | `final_suspend() { return std::suspend_never{}; }` → `std::suspend_always final_suspend() noexcept;` | 20+（17 降级：回调或状态机） |
| `co_await` 前先由 `await_ready` 判断是否就绪 | 已就绪则不挂起、退化为普通表达式，是低延迟关键 | `bool await_ready() { return false; }` → `return ready_;` | 20+ |
| `await_suspend` 返回 `coroutine_handle` 做对称传输，不要在里面直接 `resume` | 非对称写法在挂起栈上递归 `resume`，链深即栈溢出；对称传输由编译器尾调用 | `other_handle.resume();` → `return other_handle;` | 20+ |
| 热路径协程给 `promise_type` 自定义 `operator new` 做池化 | 帧默认堆分配是隐藏成本，HALO 只在简单场景生效；perf 里看到 `operator new` 热点即未消除 | 默认 `new` → `void* operator new(size_t s) { return pool.allocate(s); }` | 20+ |
| 协程内禁 `setjmp`/`longjmp`、禁阻塞式深嵌套调用；与调度器共享的句柄/标志用原子 | 无栈协程只有帧、没有独立调用栈 | 协程内 `longjmp` → 用对称传输交给调度器 | 20+ |
| `#include` 只能放在全局模块片段，宏不出现在模块接口 | 模块声明之后再 `#include` 会报错；全局片段内容不污染导出接口；宏不是模块实体 | `export module m; #include <vector>` → `module; #include <vector> export module m;` | 20+（17 降级：`#pragma once` 头文件） |
| 模块与 BMI 只在同一编译器内传递，导出模块类型的动态库同理 | 不同编译器的模块二进制格式不兼容，混用会报链接错误 | 跨编译器共享 BMI → 同一编译器编译全部模块 | 20+ |
| view 的生命周期不得超出底层数据，需要所有权时消费成容器 | view 不拥有数据，底层销毁后再用即 UB；`filter` 等输出是 `input_range`，只能遍历一次 | `auto v = vec \| filter(f); vec.clear();` → `auto v = vec \| ... \| std::ranges::to<std::vector>();` | 20+（`ranges::to` 需 23） |
| 传给要求随机访问的算法前先转成容器，迭代器类型用 `auto` | concept 不匹配会直接编译失败，`filter` 的结果不是 `random_access` | 把 `filter` 结果直接传给需要 `random_access` 的算法 → 先转 `vector` | 20+ |
| PMR 的 `monotonic_buffer_resource` 只用于短期任务 | 它只分配、不回收单个对象；buffer 满后自动走 upstream `new`，长期任务内存持续增长 | 长期复用同一个 `monotonic` → 定期重建或改用 `pool` | 17+ |
| 多线程共享池用 `synchronized_pool_resource`；嵌套容器统一用 `scoped_allocator_adaptor` | `unsynchronized` 版并发访问即数据竞争；默认分配器不会传给内层 `string` | `unsynchronized_pool_resource` → `synchronized_pool_resource` | 17+ |

**本参考未覆盖**：`atomic_ref`、`jthread`、指定初始化器、`std::ssize`、`std::launder`、`[[likely]]`、`std::invoke`/`apply` 的新用法等的逐条检查规则。
