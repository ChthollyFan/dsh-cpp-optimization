# 一、RAII 与所有权

核心判断：**每份资源都要有一个明确的、由析构函数负责的归属**。资源包括内存、文件句柄、套接字、锁、事务、临时文件、回调注册。异常栈展开、提前 `return`、`break` 都必须释放它。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 资源在构造时获取、析构时释放 | 离开作用域必调析构，提前 `return`、异常栈展开路径同样如此，保证「一定释放」 | `int* p = new int(42); if (bad) return; delete p;` → `auto p = std::make_unique<int>(42);` | 11+ |
| 禁止手工 `new`/`delete` 配对，优先栈对象或智能指针 | 堆对象漏 `delete` 则析构不跑，文件、连接全漏，比 `free` 更隐蔽 | `Logger* p = new Logger(); ... delete p;` → `Logger log;` | 11+ |
| 默认 `unique_ptr`；上 `shared_ptr` 须有真多持有者 | `shared_ptr` 多一块控制块，拷贝走原子计数，贵于 `unique_ptr` | 无理由写 `shared_ptr<W>` → `unique_ptr<W>` | 11+ |
| `unique_ptr` 禁拷贝、只能 `std::move` | 拷贝会让两个所有者各自 `delete`，双重释放 | `unique_ptr<int> q = p;` → `auto q = std::move(p);` | 11+ |
| `get()` 只作临时借用；`release()` 交还的裸指针须自行 `delete` | `reset`/析构后借用指针悬垂；`release` 即主动放弃 RAII 保护 | `auto* r = obj.get(); obj.reset(); r->f();` → `f(up.get());` | 11+ |
| 创建一律 `make_unique`/`make_shared`；只有自定义删除器、从裸指针接管、需要分离生命周期时才回退 `new` | 把分配 + 构造 + 交接并为原子操作，消除 `new` 参数求值期的泄漏窗口；`make_shared` 少一次分配 | `shared_ptr<W> sp(new W(f(), g()));` → `auto sp = std::make_shared<W>(f(), g());` | 14+ |
| 参数传法按契约选：只读 `const T&`、可空 `T*`、转移所有权按值 `unique_ptr`、共享按值 `shared_ptr`；不返回裸指针 | 按值传 `unique_ptr` 等于要求交出所有权，多数并非本意 | `void f(unique_ptr<W>);` → `void f(const W&);` | 11+ |
| 同一裸指针只喂一个 `shared_ptr`（一对象一控制块） | 各自构造出两套计数，双双归零后二次 `delete` | `shared_ptr<W> a(raw); shared_ptr<W> b(raw);` → 只从已有 `shared_ptr` 拷贝构造 | 11+ |
| 环形/双向关系一边改 `weak_ptr`；`weak_ptr` 必须 `lock()` 后使用 | 环上计数永不归零而泄漏；`expired()` 检查后再用有竞态，且 `weak_ptr` 本身不可解引用 | `if (!wp.expired()) wp->f();` → `if (auto sp = wp.lock()) sp->f();` | 11+ |
| `this` 交给 `shared_ptr` 须继承 `enable_shared_from_this`；异步回调按值捕获 `shared`/`weak` | 用裸 `this` 构造新控制块会导致双重释放；`[&]` 捕获的回调在异步执行时可能悬垂 | `shared_ptr<W>(this)` → `shared_from_this()`；`[&]` → `[self = shared_from_this()]` | 11+ |
| 临界区用 `lock_guard` 等 RAII 锁 | 手写 `lock`/`unlock` 遇异常漏 `unlock` 即死锁 | 手写 `lock(); ... unlock();` → `std::lock_guard<std::mutex> lock(mtx);` | 11+ |
| 空指针一律 `nullptr` | `NULL` 实为整数 `0`，重载决议可能选中 `f(int)` | `f(NULL);` → `f(nullptr);` | 11+ |
| 成员在声明处或初始化列表初始化，顺序同声明顺序 | 隐式默认构造不初始化内建类型（垃圾值）；函数体内赋值会让类类型成员多一次默认构造，`const` 成员与引用只能列表初始化 | `Circle(double r) { radius_ = r; }` → `Circle(double r) : radius_(r) {}` | 11+ |
| 析构函数不抛异常 | C++11 起析构默认 `noexcept`，抛出即 `std::terminate` | `~T() { throw ...; }` → 仅做不抛异常的清理 | 11+ |
| 只写析构的类要补齐拷贝语义（Rule of Three）或显式 `= delete` 拷贝、`= default` 移动 | 只写析构会让拷贝仍按成员逐个拷贝（浅拷贝指针成员），双重释放 | 只写析构、成员是裸指针 → 补深拷贝构造与赋值，或 `= delete` 拷贝 + 手动实现移动 | 11+ |

**本参考未覆盖**：多态基类虚析构与经基类指针 `delete` 的安全性（仅间接提及）、`shared_ptr` 别名构造与自定义删除器的完整语义、Valgrind/ASan 泄漏检测的具体判定流程。
