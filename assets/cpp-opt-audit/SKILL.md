---
name: cpp-opt-audit
description: 审查或优化已有 C++ 代码、或编写高性能底层 C++ 代码时使用。先探测目标工程真实的 C++ 标准（不确认标准不动手改），再按 RAII 与所有权、移动语义、异常安全、性能与内存、容器与算法、并发、模板与编译期、类型安全与 ABI、接口设计九个维度逐条给出「检查点 | 为什么 | 反例→正例 | 适用标准」的证据化报告，用户确认后才改代码。不用于纯算法科普、博客写作或与 C++ 无关的任务。
---

# C++ 优化与安全审查（cpp-opt-audit）

目标是让 C++ 代码同时满足两件事：**快**（可度量的性能收益）和**安全**（资源不泄漏、异常不逃逸、并发不竞争、标准不越界）。判断依据是代码本身、构建配置和实测数据，不是风格偏好。

## 何时使用

- 用户要求审查、点评、优化已有 C++ 代码（「这段代码有没有问题」「能不能更快」「有没有内存泄漏」）。
- 用户要求写底层 C++ 代码，并强调 RAII、移动语义、异常安全、零开销、无竞争。
- 用户给出具体性能症状（热点、频繁分配、缓存失效、锁竞争、伪共享）需要定位与修复。

## 不适用

- 纯算法或知识点的科普写作、博客改写 → 用写作类 skill（如 `chtholly-notes-style`）。
- 与 C++ 无关的任务；纯 CMake/工具链配置问题（可只看标准探测部分）。

## 硬规则（先于一切，违反即为不合格输出）

1. **标准门禁**：动手前必须先确定目标工程实际使用的 C++ 标准。确认之前，不得推荐、不得写入任何高于该标准的特性。探测不到就用 `ask_user_question` 问用户，并附上探测到的证据和候选值。见 [references/standard-detection.md](references/standard-detection.md)。
2. **默认只读**：默认只审查、只出报告，不直接改代码。得到用户明确同意后才动手；用户逐条挑选时只改被选中的条目。
3. **不改口径**：性能优化不得改变业务语义、数据口径、时间精度、排序稳定性、数据所有权与生命周期契约。涉及这些必须单独说明并获得确认。
4. **无数据不优化**：没有剖析数据、基准或复杂度分析，不得声称「更快」「更省内存」。禁止凭直觉一轮改多处；每轮只改一处并复测。
5. **每改必验**：改完至少做编译验证与 `git diff` 检查；涉及编码的文件检查中文注释是否变乱码。无法编译时明确写出未验证项，不得声称已验证。
6. **最小改动**：只改完成当前任务所需的文件与行，不顺手重排、格式化或清理无关历史问题。

## 工作流

### 阶段 0：定位工程与标准（必做，未完成不得进入阶段 1）

1. 找到构建入口：`CMakeLists.txt`、`Makefile`、`meson.build`、`*.vcxproj`、`.bazelrc`、`compile_commands.json`。
2. 从构建文件提取标准：`CMAKE_CXX_STANDARD`、`target_compile_features`、`-std=`、`/std:`、`cpp_std=`。
3. 交叉印证：工程里已在使用的特性上限、CI 脚本、README 中的环境说明。
4. 结论记成一行可引用的证据，例如：`目标标准 C++17（证据：CMakeLists.txt:12 set(CMAKE_CXX_STANDARD 17)）`。
5. 证据冲突或缺失 → `ask_user_question`。**不要默认按 C++17 或最新标准推断。**

### 阶段 1：只读扫描

按下面九个维度逐条比对代码，记录「检查点、文件:行、为什么、反例→正例、适用标准、修复代价」。只读，不改。

### 阶段 2：出报告

按 [references/audit-report-template.md](references/audit-report-template.md) 的结构输出：先给结论摘要与分级统计，再逐条展开。每条必须有代码位置和可验证的理由；不确定的写成「待确认」，不要写成结论。

### 阶段 3：确认后修改

- 先给方案（改哪些文件、改成什么、影响范围、风险），用 `ask_user_question` 取得同意后再改。
- 一次只推进一组相关检查点，改完立即验证；逻辑改动必须补至少一行中文注释说明原因。
- 保持文件原有编码与局部风格，不引入与本任务无关的改动。

### 阶段 4：验证与交付

- 编译：优先使用工程既有的构建方式与既有工具链；本机缺工具链时不要假装编过，转用工程已有的远程/CI 编译规则，或明确写出未验证。
- 正确性：涉及行为等价性的改动，必须给出可复现的对比（输入、期望、实测）。
- 性能：给出测量方法、场景与数字对比；测不出来就不写「已优化」。
- 交付说明列出：改了哪些、为什么、验证到什么程度、哪些未验证、剩余的 P2 级事项。

## 编写模式（新代码）

按同样九个维度**顺向**落地，顺序是：先定所有权与生命周期（RAII），再定值类别与接口语义（移动/转发/函数签名），再定错误处理与异常安全等级，最后才做性能技巧。性能手段必须有数据依据；在没有测量的情况下优先写清晰、无泄漏、无竞争的代码。

## 九维速查

| 维度 | 高频问题（完整清单见对应文件） | 文件 |
|---|---|---|
| 一、RAII 与所有权 | 手工 `new`/`delete` 配对；多持有者滥用 `shared_ptr`；`weak_ptr` 未 `lock()` 即用；`this` 未走 `shared_from_this()` | [references/raii-ownership.md](references/raii-ownership.md) |
| 二、移动语义与值类别 | 移动构造未标 `noexcept`；`return std::move(local)`；泛型转发误用 `std::move`；具名右值引用再传递前忘记 `std::move` | [references/move-value-categories.md](references/move-value-categories.md) |
| 三、异常安全 | 析构抛异常；裸指针 + 后续可抛异常；手写 `lock`/`unlock`；`catch` 顺序基类在前；按值捕获异常 | [references/exception-safety.md](references/exception-safety.md) |
| 四、性能与内存 | 热点循环内逐次分配；未按缓存行隔离计数器；结构体字段乱序；用 `-O0` 剖析；循环未预留容量 | [references/performance-memory.md](references/performance-memory.md) |
| 五、容器与算法 | 改容器后继续用旧迭代器；循环内 `r = r + x` 拼接；`m[k]` 当只读查询；空容器上 `top()`/`pop()` | [references/containers-algorithms.md](references/containers-algorithms.md) |
| 六、并发安全 | 线程未 `join`/`detach`；共享计数器未原子；多锁未统一顺序；`cv.wait` 无谓词；CAS 不重试 | [references/concurrency.md](references/concurrency.md) |
| 七、模板与编译期 | 函数模板用全特化代替重载；`vector<bool>` 绑 `auto&`；空包折叠无初值；模板定义未放头文件；该编译期算的留到运行期 | [references/templates-compile-time.md](references/templates-compile-time.md) |
| 八、标准边界 | 高版本特性写进低标准工程；`optional` 未判空即解引用；视图悬垂；`string_view` 直传 C 接口 | [references/standard-boundary.md](references/standard-boundary.md) |
| 九、类型安全与 ABI / 接口设计 | C 风格转换；`static_cast` 盲目下转；头文件里定义非 `inline` 全局；Pimpl 析构 `=default` 写在头文件；`const` 契约被 `mutable` 侵蚀 | [references/type-safety-abi.md](references/type-safety-abi.md)、[references/interface-design.md](references/interface-design.md) |

## 最高频检查点（先过这张表，再查对应维度文件）

| 检查点 | 反例 → 正例 | 标准 |
|---|---|---|
| 资源随对象生灭，禁止手工配对 | `int* p = new int(42); if (bad) return; delete p;` → `auto p = std::make_unique<int>(42);` | 11+ |
| 创建智能指针用工厂函数 | `std::shared_ptr<W> sp(new W(f(), g()));` → `auto sp = std::make_shared<W>(f(), g());` | 14+ |
| 临界区用 RAII 锁 | `mtx.lock(); ...; mtx.unlock();` → `std::lock_guard<std::mutex> lock(mtx);` | 11+ |
| 裸指针 + 可抛异常 = 泄漏 | `int* p = new int; risky(); delete p;` → `auto p = std::make_unique<int>(); risky();` | 11+ |
| 移动操作标 `noexcept` | `Buf(Buf&&) {}` → `Buf(Buf&&) noexcept {}` | 11+ |
| 返回具名局部对象不要 `move` | `return std::move(v);` → `return v;` | 11+ |
| 泛型转发用 `forward` | `inner(std::move(arg));` → `inner(std::forward<T>(arg));` | 11+ |
| 具名右值引用要再转移 | `void f(T&& r) { g(r); }` → `g(std::move(r));` | 11+ |
| 大对象只读参数传引用 | `void f(std::string s);` → `void f(std::string_view s);` | 17+ |
| 禁止返回局部变量的引用/指针 | `int& bad() { int l = 1; return l; }` → 按值返回 | 11+ |
| 析构与 `swap` 不抛异常 | `~T() { throw ...; }` → 只做不抛异常的清理 | 11+ |
| 强异常安全用 copy-and-swap | `v.push_back(x);` 就地改 → 副本上改成功后 `v.swap(t);` | 11+ |
| `catch` 子类在前、按 `const&` 捕获 | `catch (std::exception e)` → `catch (const std::exception& e)` | 11+ |
| 只抛标准异常或继承标准异常 | `throw 42;` → `throw std::invalid_argument("bad");` | 11+ |
| 热点循环内消除逐次分配 | 逐次 `new Node`/`delete` → 批量预分配 + 空闲链表 / `std::pmr` | 17+ |
| 跨线程计数器按缓存行隔离 | `std::atomic<int> c[N];` → `struct alignas(64) Counter { std::atomic<int> n; };` | 11+ |
| 结构体按大小降序排字段 | `{char a; double b; char c; int d;}` → `{double b; int d; char a; char c;}` | 11+ |
| 剖析用优化构建 + 调试符号 | `g++ -O0 x.cpp` → `g++ -O2 -g -fno-omit-frame-pointer x.cpp` | 11+ |
| 已知规模先 `reserve` | 循环 `push_back` → `v.reserve(n);` | 11+ |
| 拼接用 `+=` 而非 `+` | `for (...) r = r + x;` → `r.reserve(n); r += x;` | 11+ |
| 删除后重新获取迭代器 | `v.erase(it); ++it;` → `it = v.erase(it);` | 11+ |
| 只读查询不要用 `operator[]` | `if (m["k"] > 1)` → `if (auto it = m.find(k); it != m.end())` | 17+ |
| 结构化绑定默认是拷贝 | `for (auto [k, v] : m)` → `for (const auto& [k, v] : m)` | 17+ |
| 空容器禁止 `top()`/`pop()` | `int x = s.top(); s.pop();` → `while (!s.empty()) { ... }` | 11+ |
| 线程必须 `join`/`detach` | `std::thread t(f);` → 析构前 `t.join();` | 11+ |
| 共享计数器原子化或加锁 | `c++;`（多线程） → `std::atomic<int> c{0}; c++;` | 11+ |
| 多把锁用 `scoped_lock` | 两线程相反顺序加锁 → `std::scoped_lock l(a, b);` | 17+ |
| 条件变量 `wait` 带谓词 | `cv.wait(lk);` → `cv.wait(lk, [] { return ready; });` | 11+ |
| 发布数据用 release/acquire 配对 | `store(true, relaxed)` → `store(true, release)` + `load(acquire)` | 11+ |
| `async` 显式指定策略 | `std::async(g);` → `std::async(std::launch::async, g);` | 11+ |
| 用 `{}` 初始化并防窄化 | `Widget w();`（最令人烦恼的解析） → `Widget w{};` | 11+ |
| 显式四类 cast | `(int*)cp;` → `const_cast<int*>(cp);` / `static_cast` / `dynamic_cast` | 11+ |
| 头文件里的跨 TU 变量用 `inline` | 头文件 `int g_cfg;` → `inline int g_cfg;` | 17+ |
| Pimpl 的析构与移动定义在 `.cpp` | 头文件 `~Widget() = default;` → `.cpp` 中 `Widget::~Widget() = default;` | 11+ |
| 发布库稳定 ABI | 头文件暴露成员 → `struct Impl; std::unique_ptr<Impl> p;` | 11+ |

## 报告与提问纪律

- 每条结论都要能指到 `文件:行`，并说明「为什么」。说不清原因的就不要写进报告。
- 需要用户决策的分歧（标准不确定、是否容忍行为变化、是否引入新依赖、是否接受 ABI 破坏）一律用 `ask_user_question` 提出，附上选项与各自代价，不要在正文里反问。
- 报告里区分三类信息：可复现的现象、能由代码/标准支撑的机制、仍未闭环的猜测。后两类必须标明语气。

## 参考文件索引

| 文件 | 内容 |
|---|---|
| [references/standard-detection.md](references/standard-detection.md) | 目标工程 C++ 标准探测步骤、`__cplusplus` 校验、17/20/23 特性降级映射表 |
| [references/audit-report-template.md](references/audit-report-template.md) | 审查报告结构、P0/P1/P2 分级标准、单条问题写法与完整示例 |
| [references/raii-ownership.md](references/raii-ownership.md) | RAII 与所有权（15 条） |
| [references/move-value-categories.md](references/move-value-categories.md) | 移动语义与值类别（12 条） |
| [references/exception-safety.md](references/exception-safety.md) | 异常安全（14 条） |
| [references/performance-memory.md](references/performance-memory.md) | 性能与内存（13 条） |
| [references/containers-algorithms.md](references/containers-algorithms.md) | 容器与算法（7 条） |
| [references/concurrency.md](references/concurrency.md) | 并发安全（14 条） |
| [references/templates-compile-time.md](references/templates-compile-time.md) | 模板与编译期（9 条） |
| [references/standard-boundary.md](references/standard-boundary.md) | 标准边界：C++17 与 20/23 特性取舍（24 条 + 11 条深入机制） |
| [references/type-safety-abi.md](references/type-safety-abi.md) | 类型安全与 ABI（13 条） |
| [references/interface-design.md](references/interface-design.md) | 对象语义与接口设计（13 条） |

以上检查点按主题逐条整理，每条标注适用标准，未覆盖的主题在各文件末尾单列。
