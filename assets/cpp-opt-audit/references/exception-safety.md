# 三、异常安全

核心判断：**抛出异常时，对象是否仍然有效、资源是否仍然被释放、锁是否仍然会解开**。异常安全分三档：基本保证（不泄漏、对象有效）、强保证（失败则回到操作前状态）、不抛保证（`noexcept`）。报告中要写清每条建议落在哪一档。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 析构函数绝不抛异常 | 栈展开中析构再抛，两个异常同时活跃 → `std::terminate` | `~Bad() { throw std::runtime_error("x"); }` → `~Bad() { try { ... } catch (...) { /* 记录 */ } }` | 11+ |
| 移动构造/移动赋值/`swap` 标 `noexcept`；可能分配内存或抛业务异常的函数不要标 | `vector` 扩容据此决定用移动还是退回拷贝；标错则 `terminate` 而非传播 | `NotSafe(NotSafe&&) {}` → `Movable(Movable&&) noexcept {}` | 11+ |
| 需要强异常安全时用 copy-and-swap | 先在临时副本上修改，成功才用不抛异常的 `swap` 交换 | 强保证场景直接改 `v.push_back(x);` → `auto t = v; t.push_back(x); v.swap(t);` | 11+ |
| 裸指针 + 后续可能抛异常 = 泄漏 | 栈展开会跳过 `delete` | `int* p = new int; risky(); delete p;` → `auto p = std::make_unique<int>(); risky();` | 11+ |
| 加锁必须用 RAII（`lock_guard`） | 手写 `lock`/`unlock` 遇异常永不解锁，其他线程全部阻塞 | `mtx.lock(); ...; mtx.unlock();` → `std::lock_guard<std::mutex> lock(mtx);` | 11+ |
| `catch` 顺序必须子类在前、基类在后 | 先写基类会截胡子类，后续 `catch` 永不执行 | `catch (const std::exception&)` 写在最前 → 具体的 `catch (const std::invalid_argument&)` 在前 | 11+ |
| 按 `const` 引用捕获异常 | 按值捕获会切片，丢失派生类型与 `what()` 信息 | `catch (std::exception e)` → `catch (const std::exception& e)` | 11+ |
| 顶层必须有兜底 `catch (...)` | 无匹配 `catch` 直接 `std::terminate`、进程崩溃 | 无兜底 → `main` 与每个线程入口都加 `catch (...)` | 11+ |
| 只抛标准异常类或自定义异常类 | 抛裸类型无 `what()`，`catch (const std::exception&)` 接不住 | `throw 42;` → `throw std::invalid_argument("bad");` | 11+ |
| 自定义异常继承 `runtime_error`/`logic_error`，构造时把消息拼给基类 | `std::exception` 没有接受 `string` 的构造函数 | `class E : public std::exception { ... }` → `class E : public std::runtime_error { ... }` | 11+ |
| 异常不得穿过 C 边界；C 库 `errno` 在边界转 `std::system_error` | C 无异常机制，穿过即 `terminate` | 回调里直接抛 → 边界内 `catch` 后转返回码；`throw std::system_error(errno, std::generic_category(), msg);` | 11+ |
| 高频、可预期的错误用返回码/`optional`/`expected`，罕见致命错误才用异常；不要用异常做控制流 | 异常正常路径零开销但抛出昂贵，错误码每次都要检查 | 「文件可能不存在」抛异常 / 用 `throw` 跳出循环 → 返回 `std::optional`，正常 `break` | 17+（`expected` 为 23） |
| `expected`/`optional` 返回值不得忽略 | 忽略即静默漏错，丢失失败原因 | `parse(...);` → `if (!r) { log(r.error()); return; }` | 23（C++17 降级 `optional` + 错误码） |
| 构造函数抛异常时，已构造成员的析构会被调用，但构造函数体内的裸资源不会 | 成员按声明逆序析构，函数体内手工获取的资源没有归属 | 构造函数体内 `p = new T;` 之后再抛 → 改为成员初始化列表 + 智能指针成员 | 11+ |

**本参考未覆盖**：跨线程异常传播（`future`/`jthread`）、`terminate_handler` 定制、`-fno-exceptions` 环境下的写法。
