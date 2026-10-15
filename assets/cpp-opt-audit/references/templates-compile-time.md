# 七、模板与编译期

核心判断：**这份泛化能力是不是编译期就能定下来、实例化成本是否可控、分支是否会让不该编译的代码参与编译**。模板问题常常表现为「报错信息看不懂」「只在某个类型上崩」或「编译时间与体积失控」。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 函数模板按类型定制优先用重载，不要用全特化；函数模板不能偏特化 | 全特化不参与重载决议，偏序写错会静默走通用版本 | `template <> void f<int>(int);` → 写同名重载函数 | 11+ |
| 特化必须与原模板同命名空间、使用前声明、不改变成员签名；注意 `vector<bool>` 的元素是代理对象，不要绑 `auto&` | 否则特化不被选中；代理对象无法绑定引用 | `auto& r = v[3];` → `bool b = v[3];` | 11+ |
| 包展开用折叠表达式替代递归展开；空包用带初值的二元折叠 | 空包用一元折叠对非 `&&`/`\|\|`/逗号运算符通常 UB 或格式错误 | `(a + ...)` → `(a + ... + 0)` | 17+ |
| 模板分支用 `if constexpr`；判类型前先 `decay`，注意 `is_same<int, const int>` 为假 | 普通 `if` 两支都要实例化编译；不 `decay` 会误判数组/引用/`const` | `if constexpr (std::is_integral_v<T>)`、`std::is_same_v<std::decay_t<T>, int>` | 17+ |
| 新代码用 concepts 约束模板参数 | 报错会点明「约束未满足」，而不是展开一大段实例化机制 | `template <std::integral T>` | 20+（C++17 降级 `enable_if_t` + traits） |
| 探测「类型是否具备某成员/接口」用 `void_t` detection idiom | 按有无某接口决定分派实现，比直接写死更稳 | `std::void_t<decltype(std::declval<T>().size())>` | 17+ |
| 模板定义放头文件，或显式实例化 + `extern template` | 只声明会 undefined reference；后者挡掉各 TU 重复实例化，降低编译时间与体积 | `template class std::vector<int>;` + `extern template class std::vector<int>;` | 11+ |
| 类型差异编译期就能定用模板/CRTP，运行期才见分晓用虚函数 | CRTP 无 vtable、对象更小、可内联，但不能装进异构容器，`-O0` 下可能更慢 | `vector<ShapeC*>` 装不进 CRTP 族 → 用虚基类指针容器 | 11+ |
| 常量计算、查表用 `constexpr` 提前到编译期；需要硬保证用 `consteval`，静态初始化顺序用 `constinit` | 常量表达式语境会强制求值；不允许 I/O、编译期泄漏、UB | `int arr[fact(5)];`（C++11 起可用 `constexpr` 函数）、`consteval`/`constinit` | 11+（`consteval`/`constinit` 需 20） |

**本参考未覆盖**：modules、ranges 用法、协程、编译期反射（仅提及提案）。
