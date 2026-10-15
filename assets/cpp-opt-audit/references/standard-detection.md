# 目标工程 C++ 标准探测与降级映射

任何审查结论都必须落在「该工程用现有编译器、现有标准能编过」的特性集合内。同一段代码在 C++14 工程里可能是编译错误，在 C++20 工程里只是风格问题。**标准没确认之前，不要给出任何涉及新特性的建议。**

## 一、探测顺序

按可靠性从高到低采集证据，至少取两处互相印证。

| 顺序 | 证据源 | 看什么 | 结论示例 |
|---|---|---|---|
| 1 | `compile_commands.json` | 实际编译命令行里的 `-std=` / `/std:` | `-std=gnu++17` → GNU C++17 |
| 2 | `CMakeLists.txt` / `*.cmake` | `CMAKE_CXX_STANDARD`、`CMAKE_CXX_STANDARD_REQUIRED`、`CMAKE_CXX_EXTENSIONS`、`target_compile_features(... cxx_std_17)` | `CMAKE_CXX_STANDARD 17` |
| 3 | `Makefile` / `configure.ac` | `CXXFLAGS` 中的 `-std=c++NN` | `-std=c++14` |
| 4 | `*.vcxproj` / `CMakeSettings.json` | `<LanguageStandard>stdcpp17</LanguageStandard>`、`/std:c++17` | MSVC C++17 |
| 5 | `meson.build` | `cpp_std=c++17` | C++17 |
| 6 | `.bazelrc` / `BUILD` | `--cxxopt=-std=c++17`、`copts` | C++17 |
| 7 | 既有代码 | 已使用的最高特性（结构化绑定、`if constexpr`、折叠表达式、concepts、`<=>`、`std::span`…） | 出现折叠表达式 → 至少 C++17 |
| 8 | CI / 构建脚本 / README | 显式写出的工具链与标准 | `CentOS 7.9 + devtoolset-11` |

**权威性提醒**：`CMAKE_CXX_STANDARD` 只在没有更显式的 `-std` 时生效；工程可能在某些 target 上覆盖为更高标准（`target_compile_features` 会取最大值）。看到多处不一致时以 `compile_commands.json` 为准，其次看具体 target 的设置。

## 二、编译期验证（最可靠的一手证据）

宏由编译器按实际模式定义，比读构建文件更直接：

```cpp
#include <cstdio>
int main() {
    std::printf("__cplusplus = %ld\n", static_cast<long>(__cplusplus));
}
```

```bash
g++ -dM -E -x c++ /dev/null | grep __cplusplus   # GCC/Clang：直接问预处理宏
cl /EP /d1PP x.cpp                               # MSVC 需要带 /std: 编译
```

`__cplusplus` 对照：`201103L` C++11、`201402L` C++14、`201703L` C++17、`202002L` C++20、`202302L` C++23。
注意 MSVC 默认（未给 `/Zc:__cplusplus`）会报 `199711L`，需要用 `/std:c++17 /Zc:__cplusplus` 才准确。

工程里已有断言时优先复用，例如既有的 `static_assert(__cplusplus >= 201703L, "requires C++17");`。

## 三、`-std=` 与 `-std=gnu++NN` 的区别

- `-std=c++17`：关闭 GNU 扩展。`__restrict__`、变长数组、`typeof`、语句表达式等扩展不可用。
- `-std=gnu++17`（多数 Linux 工程的默认，`CMAKE_CXX_EXTENSIONS=ON`）：扩展可用。

因此「加 `__restrict__` 帮向量化」这类建议要先确认是否处于 GNU 扩展模式，否则给出严格标准的等价写法（`std::assume_aligned` 也要 C++20，C++17 只能用 `__builtin_assume_aligned` 或重构循环消除别名）。

## 四、旧工具链与标准可用性对照

| 编译器 | 完整 C++17 | 备注 |
|---|---|---|
| GCC 7 及以上 | 是 | `-std=c++17` 可用；GCC 5/6 只是部分支持 |
| GCC 4.8.5（CentOS 7 默认） | 否 | 实际只到 C++11 的一部分，需要 devtoolset / SCL 或升级编译器 |
| Clang 5 及以上 | 是 | libstdc++ 版本同样影响 `std::optional`、`std::filesystem` 的可用性 |
| MSVC 2017 15.7+ | 是 | 需要 `/std:c++17`，并按需 `/Zc:__cplusplus` |
| MSVC 2019 16.11+ / 2022 | C++20 部分 | `/std:c++20` |

标准库版本独立于语言特性：即使编译器支持 C++17 语法，若链接的是老 libstdc++，`std::filesystem`、`std::pmr`、`std::shared_mutex` 也可能不可用。建议在结论里写明「语言标准 + 标准库实现 + 编译器版本」三项。

## 五、判定、记录与提问

1. 把结论写成一行可引用的证据：`目标标准 C++17（证据：CMakeLists.txt:12、compile_commands.json:3 -std=gnu++17；编译器 GCC 9.3.1，CentOS 7.9）`。
2. 证据缺失、或互相冲突（如 CMake 写 17、Makefile 写 14、CI 用 GCC 4.8.5），用 `ask_user_question` 询问，并给出候选与各自影响，不要自行选一个继续。
3. 报告里每条建议标注所需标准，例如 `[C++17]`、`[C++20]`；工程标准低于该条时不直接给高版本写法，而是给降级写法并注明「升级标准后可简化」。

## 六、降级映射表（按能力查）

| 能力 | C++11 | C++14 | C++17 | C++20 | C++23 |
|---|---|---|---|---|---|
| 约束模板参数 | `enable_if` + traits | 同左 | `enable_if_t` + `_v` 变量模板 | concepts | — |
| 三路比较 | 手写六个比较运算符 | 同左 | 手写六个 | `operator<=>(...) const = default` | — |
| 连续内存视图 | 指针 + 长度 | 同左 | 同左（或 `gsl::span`） | `std::span` | — |
| 成功/失败返回 | 错误码 / `pair<bool,T>` | 同左 | `std::optional`、`std::variant<V,E>` | — | `std::expected<V,E>` |
| 类型安全格式化 | `printf` / `ostringstream` | 同左 | 同左（或引入 fmt 库） | `std::format` | `std::print` |
| 位重解释 | `memcpy` | 同左 | `memcpy` | `std::bit_cast` | — |
| 只读字符串参数 | `const std::string&` | 同左 | `std::string_view` | — | — |
| 空成员不占空间 | 继承空基类（EBO） | 同左 | 同左 | `[[no_unique_address]]` | — |
| 一次性/可复用同步原语 | 条件变量 + 计数 | 同左 | 同左 | `std::latch`、`std::barrier`、`std::semaphore` | — |
| 可停止线程 | `std::thread` + 手动停止标志 | 同左 | 同左 | `std::jthread` / `stop_token` | — |
| 原子等待/唤醒 | 条件变量 | 同左 | 同左 | `atomic::wait`/`notify_*` | — |
| 非原子对象的原子访问 | 加锁或改类型 | 同左 | 同左 | `std::atomic_ref` | — |
| ranges 管道 | 手写循环 | 同左 | 同左 | `std::ranges` 视图 | `ranges::to<Container>` |
| 字符串前缀判断 | `compare(0, n, p) == 0` | 同左 | 同左（**C++17 没有 `starts_with`**） | `s.starts_with(p)` | — |
| 容器是否含有键 | `find != end` | 同左 | 同左 | `c.contains(k)` | — |
| 迭代器距离的有符号类型 | `static_cast<ptrdiff_t>` | 同左 | 同左 | `std::ssize(c)` | — |
| 折叠表达式 | 递归展开 / 初始化列表技巧 | 同左 | `(args + ...)` | — | — |
| 编译期分支 | tag dispatch / SFINAE | 同左 | `if constexpr` | — | — |
| 多返回值解包 | `std::tie` / `std::get` | 同左 | 结构化绑定 `auto [a,b]` | — | — |
| 跨 TU 常量/变量 | 内联函数返回 / `static` 局部 | 同左 | `inline` 变量 | — | — |
| 类模板推导 | 显式写模板实参 | 同左 | CTAD `std::pair p{1, 2.0};` | — | — |
| `constexpr` 容器操作 | 不可用 | 部分可用 | 受限 | `constexpr` 动态分配 | — |
| 编译期强制求值 / 静态初始化顺序 | — | — | `constexpr` + `static_assert` | `consteval` / `constinit` | — |
| 指定初始化器 | — | — | — | `Point p{.x=1, .y=2};` | — |
| 模块 | 头文件 + include guard | 同左 | 同左（`#pragma once`） | 模块（`export module`），BMI 不跨编译器 | — |
| 协程 | 回调 / 状态机 / 第三方库 | 同左 | 同左 | 原生协程 | — |
| deducing this | — | — | — | — | `void f(this auto&& self)` |
| 内存池/分配器 | 自定义 allocator | 同左 | `std::pmr` | — | — |
| 文件系统 | boost / 平台 API | 同左 | `std::filesystem` | — | — |
| 并行算法 | 手写线程 | 同左 | `std::execution::par`（需 TBB 后端） | — | — |
| 共享读写锁 | `std::shared_mutex`（C++14 起） | 已有 | 已有 | — | — |

## 七、常见越界写法与替换

| 越界写法（需要更高标准） | 在低标准工程里的等价写法 |
|---|---|
| `template <std::integral T>` | `template <typename T, std::enable_if_t<std::is_integral_v<T>, int> = 0>`（C++17）/ `typename std::enable_if<...>::type* = nullptr`（C++11） |
| `auto operator<=>(const V&) const = default;` | 手写 `==`、`!=`、`<`、`<=`、`>`、`>=`，或只写 `==` 与 `<` 再用 `std::rel_ops`-风格派生 |
| `std::span<const T>` | `const T* data, std::size_t count` 或自研轻量视图 |
| `std::expected<V, E>` | `std::optional<V>` + 输出/错误码参数，或 `std::variant<V, E>` |
| `std::format("{},{}", a, b)` | `std::ostringstream` 或引入 `fmt` 库（需评估依赖是否允许） |
| `std::bit_cast<uint32_t>(f)` | `std::uint32_t u; std::memcpy(&u, &f, sizeof u);` |
| `std::latch` / `std::barrier` | `std::mutex` + `std::condition_variable` + 计数器封装 |
| `std::jthread` | `std::thread` + `std::atomic<bool>` 停止标志 + 析构中 `join` |
| `std::atomic_ref<T>` | 把该数据改为 `std::atomic<T>`，或用锁保护 |
| `std::ranges::to<std::vector>()` | 手写循环 `push_back`，或先物化到容器再处理 |
| `s.starts_with(p)` | `s.compare(0, std::strlen(p), p) == 0`（注意 C 字符串长度）或 `s.rfind(p, 0) == 0` |

## 八、把标准约束写进报告

- 每条建议给出「最低所需标准」标注；工程标准满足时直接给建议写法。
- 工程标准不满足时，先给降级写法，再单独一条「可选升级」说明升级后如何简化，并说明升级的代价（工具链、CI、依赖、ABI）。
- 涉及 ABI 的建议（Pimpl、`inline` 变量、导出符号）要额外说明是否会破坏已发布库的二进制兼容。
