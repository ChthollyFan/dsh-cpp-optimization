# 五、容器与算法

核心判断：**容器的迭代器/引用在操作后是否还有效、复杂度是否与访问模式匹配、容器元素的类型选择是否合理**。容器误用多数直接落到 UB，另一部分是把 `O(n)` 写成 `O(n²)`。

| 检查点 | 为什么要 | 反例 → 正例 | 标准 |
|---|---|---|---|
| 容器改动后旧迭代器/引用/指针必须重新获取；循环删除用 `erase` 的返回值，禁止在范围 `for` 内增删；规模已知先 `reserve` | 失效句柄再解引用或 `++it` 是 UB；`vector`/`string` 扩容、`unordered_*` 的 rehash 会让全部失效 | `v.erase(it); ++it;` → `it = v.erase(it);`；循环前先 `v.reserve(n);` | 11+ |
| 字符串拼接用 `reserve` + `+=`，禁止循环里 `r = r + x` | `+` 每次都新建 `string` 再整体拷贝，产生大量分配 | `for (...) r = r + x;` → `r.reserve(n); r += x;` | 11+ |
| 下标可能越界用 `.at()`；只读查询不要用 `operator[]`（会插入默认值），用 `find`/`at`；`find` 结果必须比对 `npos`；`c_str()` 即取即用 | `[]` 越界与悬垂指针是 UB；`operator[]` 无键时先插默认值；`size_t` 无符号使 `>= 0` 恒真、`npos` 当下标越界 | `m["x"] > 1`、`s.find(x) >= 0`、`p = s.c_str(); s += "!"; use(p);` → `m.find(k)`、`!= std::string::npos`、`use(s.c_str());` | 11+ |
| 按访问模式选容器：遍历/尾部追加用 `vector`、两端用 `deque`、有序或范围查询用 `map`、纯键查用 `unordered_map`，`list` 只用于位置已知的中间插入；容器存值或 `unique_ptr`，不存裸指针；小数据线性扫描可能更快 | `list` 节点分散，遍历可能慢 3~10 倍，缓存局部性常胜过理论复杂度 | `std::vector<Foo*>` → `std::vector<Foo> v; v.reserve(n);` | 11+ |
| `sort`/二分要求随机访问迭代器且数据已排序（`list` 用成员 `l.sort()`）；只取前 k 个或中位数用 `partial_sort`/`nth_element` | 未排序时二分结果未定义且不报错；全排序做了多余工作 | `std::sort(l.begin(), l.end());`、先全排序再取第 k 个 → `l.sort();`、`std::nth_element(v.begin(), v.begin() + k, v.end());` | 11+ |
| 并行策略 `par` 只用于百万级数据；并行函数对象不得改共享状态、不得抛异常；结构化绑定默认是拷贝，大对象写 `const auto&` | 小数据上线程开销反而更慢；竞争或异常是 UB；拷贝有开销 | `for (auto [k, v] : m)` → `for (const auto& [k, v] : m)` | 17+（并行算法需 TBB 后端；C++17 之前手写 `std::thread` 或串行） |
| 空 `stack`/`queue`/`priority_queue` 上调用 `top()`/`pop()`/`front()` 前先判 `empty()`；`priority_queue` 的比较器是类型且方向与 `sort` 相反 | 无元素时是 UB；比较器写反会得到与原意相反的堆 | `int x = s.top(); s.pop();`、小顶堆误传 `std::less<int>` → `while (!s.empty()) { s.top(); s.pop(); }` | 11+ |

**本参考未覆盖**：`ranges`/`views` 管道（C++20）、`std::span`（C++20）、`flat_map`/`mdspan`（C++23）、哈希碰撞攻击的具体防护措施。
