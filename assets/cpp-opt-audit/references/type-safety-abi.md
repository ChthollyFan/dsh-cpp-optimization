# 九、类型安全与 ABI

核心判断：**这次转换是否可检查、这个对象布局是否被外部依赖、这个符号是否跨 TU/跨语言暴露**。类型安全问题的代价通常是静默 UB；ABI 问题的代价是「重新编译就崩」或「升级一个库就链接失败」。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 禁止 C 风格转换，显式选四类 cast；`const_cast` 只用于本非 `const` 的对象 | `(T)x` 一把抓、意图不明且不可 grep；`reinterpret_cast` 的结果几乎总是实现定义或 UB；改写本身 `const` 的对象是 UB | `(int*)cp;` → `const_cast<int*>(cp);`；`const int x = 5; const_cast<int&>(x) = 10;` → 只对非 `const` 对象去 `const` | 11+ |
| 向下转换优先用虚函数，否则用 `dynamic_cast` 并判空；用 `typeid` 查动态类型须传 `*p`，比较用 `typeid(a) == typeid(b)` | `static_cast` 下转不检查、类型不符即 UB；`dynamic_cast` 指针版失败返回 `nullptr`、引用版抛 `bad_cast`；`typeid(p)` 得到的是静态指针类型，`name()` 是实现定义的 mangled 名（`_ZTS*`），不能当比较键 | `static_cast<D*>(b)->f();` → `if (auto* d = dynamic_cast<D*>(b)) d->f();` | 11+ |
| 统一用 `{}` 初始化，成员按声明顺序；容器分清 `(n)` 与 `{v}` | `T w();` 被当作函数声明（most vexing parse），`{}` 禁窄化；初始化列表顺序与声明不一致会告警；标量不初始化即不确定值；`v(3)` 是 3 个 0、`v{3}` 是 1 个 3 | `Widget w(); int x{3.5};` → `Widget w{}; int x{3};` | 11+ |
| `const` 是真契约，`mutable` 只留给缓存/懒求值/互斥量 | `const` 成员函数承诺不改非 `mutable` 成员；`const` 方法返回非 `const` 引用会破坏封装 | `T& get() const;` → `const T& get() const;` | 11+ |
| Pimpl 的析构与移动必须在 `.cpp` 中定义 | `unique_ptr<Impl>` 的默认析构/移动要求 `Impl` 完整，在头文件里 `= default` 会因不完整类型报错；值语义还需自己实现深拷贝 | 头文件 `~Widget() = default;` → `.cpp` 中 `Widget::~Widget() = default;` | 11+ |
| 发布库用 Pimpl 稳定 ABI：不改类布局、不新增虚函数；跨语言边界加 `extern "C"` | 增删成员会改对象大小/偏移，新增虚函数会改 vtable 布局，均破坏 ABI；C 符号无名字修饰，缺 `extern "C"` 即 undefined reference，且不能重载 | 头文件暴露成员 → `struct Impl; std::unique_ptr<Impl> p;`；`int api_init(int);` → `extern "C" int api_init(int);` | 11+ |
| 运算符重载：`=`、`[]`、`()`、`->` 必须是成员；对称二元运算符与 `<<` 用非成员；禁止重载 `&&`、`,`、`&` | 非成员才能让左操作数参与隐式转换；重载 `&&`/逗号会破坏短路求值与求值顺序 | `bool operator&&(A, B);` → 删除，改成具名函数 | 11+ |
| 关系运算符在 C++20 用 `operator<=>(const V&) const = default` 一次生成六个 | C++17 没有三路比较，必须手写 `==`/`!=`/`<`/`<=`/`>`/`>=`，或只由 `==`、`<` 派生 | `auto operator<=>(const V&) const = default;` | 20+（17 降级：手写六个或派生） |
| 泛型交换写 `using std::swap; swap(a, b);` | ADL 会到实参类型所在命名空间选更优的 `swap`，写死 `std::swap` 会错过用户重载 | `std::swap(a, b);` → `using std::swap; swap(a, b);` | 11+ |
| 用户定义字面量（UDL）后缀必须以 `_` 开头并用 `constexpr` 实现 | 不带下划线的后缀保留给标准库，自行声明属非标准/UB；`constexpr` 可把单位换算提到编译期 | `operator""kg(...)` → `operator""_kg(long double x)` | 11+ |
| 声明放头文件、定义放唯一 `.cpp`；跨 TU 常量/变量用 `inline` 变量 | 两个 TU 各有非 `inline` 定义违反 ODR、报重复符号；`static`/匿名命名空间是内部链接，各 TU 不互通且可能膨胀 | 头文件 `int g_cfg;` → `inline int g_cfg;` | 17+（17 之前用内联函数返回引用或 `static` 局部） |
| 类型擦除必须实现 `clone`；自定义迭代器必须补 `iterator_traits` 的关联类型 | 擦除后具体类型不可见，默认浅拷贝会导致悬垂/双重释放；缺 traits 会让算法退化或编译失败 | `std::unique_ptr<Concept> clone() const override { return std::make_unique<Model>(*this); }` | 17+（concepts 版需 20） |
| 禁止返回局部对象的引用；容器重新分配后旧迭代器/引用失效 | C++ 没有借用检查，编译器至多告警，运行即 UB/悬垂 | `const std::string& f() { std::string s; return s; }` → 按值返回 | 11+ |

**本参考未覆盖**：C++23 `std::expected`、deducing this 的审查规则；concepts、ranges、modules 仅零星提及。
