# 十、对象语义与接口设计

核心判断：**这个接口的契约是否被类型系统表达出来、调用者能否从签名正确推断行为**。接口问题往往不立即报错，但会让误用在编译期无法被发现。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| `const` 入参用 `const T&` | 零开销的只读契约，由编译器强制 | `void f(std::string s);` → `void f(const std::string& s);` | 11+ |
| `const` 对象只能调用 `const` 成员函数，只读操作必须标 `const` | `const` 成员函数就是「不修改对象」的契约 | `int getX();` → `int getX() const;` | 11+ |
| `mutable` 只留给锁、缓存、计数 | 它绕过 `const` 契约，用得越多契约越不可信 | 一律给成员加 `mutable` → 只给计数器/互斥量加 | 11+ |
| `const` 可参与重载，`operator[]` 给可写/只读双版本 | 同一语法在 `const` 对象上自动走只读版本 | 只提供 `char& operator[](size_t);` → 再补 `const char& operator[](size_t) const;` | 11+ |
| `auto` 按值推导会剥掉引用与顶层 `const` | 误以为在改原对象，实际改的是副本 | `auto a = ref;` → `auto& a = ref;` | 11+ |
| 头文件里的小工具函数加 `inline` | 兼管「重复定义豁免」；大函数或递归函数写了没有意义 | 头文件里的 getter 加 `inline` | 11+ |
| 运算符重载的语义必须符合直觉，不可造新符号、不可改优先级 | 语义错位等于埋雷 | `operator+` 里做减法 → 保持加法语义 | 11+ |
| `operator<<` 用全局 + 友元并返回 `std::ostream&` | 左操作数是 `cout`；返回引用才能链式调用 | 返回 `void` → 返回 `os` 的引用 | 11+ |
| 重写虚函数必须写 `override`；不允许继续重写或继承用 `final` | 签名（含 `const`）写岔会静默变成新函数、多态失效 | `void g() const;` → `void g() const override;` | 11+ |
| lambda 需要保存、返回或跨异步执行时用值捕获 | 引用捕获与 `[this]` 的生存期不足即悬垂；C++17 还可用 `[*this]` 按值拷对象 | `[&local]` → `[local]` | 11+（`[*this]` 需 17） |
| 热路径避免用 `std::function` 包 lambda | 类型擦除带来堆分配与间接调用 | 模板算法直接接收 lambda 模板参数 | 11+ |
| 多重继承只用于纯虚接口组合 | 实现多重继承与虚继承会引入查表间接层 | 多个纯虚基类 + `override`，少用虚继承 | 11+ |
| 高频输出用 `'\n'` 而非 `std::endl` | `endl` 强制 flush，等于频繁系统调用 | `std::cout << i << std::endl;` → `std::cout << i << '\n';` | 11+ |

**本参考未覆盖**：拷贝/移动构造与赋值的细节（见移动语义文件）、三/五法则与 Rule of Zero 的取舍、`swap` 与强异常安全、PIMPL、返回类型协变、`std::format` 之外的 C++20 接口设计特性。
