# 六、并发安全

核心判断：**有没有共享可变状态、临界区是否覆盖了全部访问路径、同步原语用得对不对**。并发缺陷（数据竞争、丢更新、死锁、虚假唤醒）大多不报错、只在压力下偶发，因此必须按机制而不是按现象判断。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| `std::thread` 必须 `join` 或 `detach` | 两者都没做时，析构函数会 `terminate` | `std::thread t(f);` → 析构前 `t.join();` | 11+ |
| 共享变量的读写必须加锁或原子化 | 非原子的读-改-写会丢更新，属 UB | `c++;`（多线程） → `std::atomic<int> c{0}; c++;` | 11+ |
| 锁一律 RAII，禁止裸 `lock`/`unlock` | 异常或提前 `return` 会漏解锁 | `m.lock(); ... m.unlock();` → `std::lock_guard<std::mutex> g(m);` | 11+ |
| 一次取多把锁用 `scoped_lock` 或统一加锁顺序 | 相反顺序加锁形成循环等待 → 死锁 | 两线程分别 `a→b`、`b→a` → `std::scoped_lock l(a, b);` | 17+（C++11 可用 `std::lock` + `lock_guard` 组合） |
| `cv.wait` 必须带谓词 | 防虚假唤醒与丢通知 | `cv.wait(lk);` → `cv.wait(lk, [] { return ready; });` | 11+ |
| 发布数据用 release 写 + acquire 读配对 | `relaxed` 不保证可见性，读者可能看到半成品 | `store(true, relaxed)` → `store(true, release)` + `load(acquire)` | 11+ |
| 内存序不熟就用默认 `seq_cst`，只有纯计数才考虑 `relaxed` | 默认最强、最不易错；x86 实测 `relaxed` 与 `seq_cst` 差别通常 < 10% | 用 `relaxed` 发布指针 → 用默认内存序 | 11+ |
| 默认用锁，确认是瓶颈之后再上原子/无锁 | 原子操作要靠人推理内存序；实测自旋锁 86.52 ns 慢于 mutex 53.23 ns | 用自旋锁保护长临界区 → 用 `std::mutex` | 11+ |
| CAS 必须循环重试 | 失败时 `expected` 已被更新为当前值，直接放弃会丢更新 | 单次 CAS 失败即返回 → `while (!head.compare_exchange_weak(o, n, release, relaxed));` | 11+ |
| 无锁结构需防 ABA 与节点回收 | 值复原会让 CAS 误成功；节点被删后仍可能有读者 | 裸指针 CAS → tagged pointer / hazard pointer | 11+ |
| `async` 显式指定 `launch::async`，`get` 只调一次 | 默认策略可能是 `deferred`，不 `get` 就永不执行；多次等待要用 `shared_future` | `std::async(g);` → `std::async(std::launch::async, g); f.get();` | 11+ |
| 线程池 worker 用谓词式 `wait`；析构时 `stop` + `notify_all` + `join`；任务异常就地捕获 | 虚假唤醒会取到空任务、worker 永久阻塞、异常逃逸会 `terminate` | `if (stop) return;` → `cv.wait(lk, [&] { return stop \|\| !q.empty(); });` | 11+ |
| 临界区最小化；读多写少用 `std::shared_mutex` | 临界区越长锁竞争越凶、吞吐越低 | 整个函数持锁 → 先在锁内拷贝数据，锁外计算，再锁回写 | 14+（`shared_mutex`） |
| C++20 的 `barrier`/`latch`/`semaphore` 可替代手工同步；`count_down` 不能超过初始计数 | `latch` 一次性、`barrier` 可复用；超计数是 UB | 手写计数器 + 条件变量 → `std::latch d(5); d.count_down(); d.wait();` | 20+（C++17 降级：`condition_variable` + 计数器封装） |

**本参考未覆盖**：`jthread`/`stop_token`、`atomic_ref`、`atomic::wait`/`notify_*`、伪共享对齐规避的完整做法、`memory_order_consume` 与 `atomic_thread_fence` 的实战用法。
