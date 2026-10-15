# @chtholly-fan/dsh-cpp-optimization

[English](README.en.md) | 中文

一个给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的 bundle 插件包，装好后提供一个 skill：**`cpp-opt-audit`**，用于审查或编写「又快又安全」的底层 C++ 代码。

它的核心约束是**先确认目标工程真实的 C++ 标准**：探测不到就问用户，标准确认之前不推荐、不写入任何高于该标准的特性。结论全部带着「检查点 / 为什么 / 反例→正例 / 适用标准」四要素。

## 安装

在 DSH 会话中让智能体安装本包，或自行调用 `plugin_manager` 工具的 `install_bundle` 动作；`target` 传包名或本地目录的绝对路径：

```
target: @chtholly-fan/dsh-cpp-optimization
```

也可以直接从本仓库目录安装：

```
target: <本仓库目录的绝对路径>
```

安装由 `plugin_manager` 完成：它会写入所在 profile 的包依赖并选中本包的 `cordis.patch.yml`。**不要手动改 profile 的 `package.json` 或 `cordis.patch.yml`，也不要在 profile 目录里跑 pnpm。**

安装后无需重启即可在会话目录里看到 `cpp-opt-audit`；如果替换了已安装的同名包，需要重启以加载新的模块。

## 使用

- 模型自动触发：任务涉及 C++ 代码审查、优化、底层实现时，会话目录会提示模型先加载该 skill。
- 用户显式调用：直接输入 `/cpp-opt-audit`。

skill 的工作方式是**两阶段**：默认只读审查并输出带证据的报告，得到同意后才改代码。

## 内容结构

```
assets/cpp-opt-audit/
├── SKILL.md                          # 入口：硬规则、四阶段工作流、高频检查点速查表
└── references/
    ├── standard-detection.md         # 标准探测步骤、__cplusplus 校验、17/20/23 降级映射
    ├── audit-report-template.md      # 报告结构、P0/P1/P2 分级、单条问题写法
    ├── raii-ownership.md             # 一、RAII 与所有权（15 条）
    ├── move-value-categories.md      # 二、移动语义与值类别（12 条）
    ├── exception-safety.md           # 三、异常安全（14 条）
    ├── performance-memory.md         # 四、性能与内存（13 条）
    ├── containers-algorithms.md      # 五、容器与算法（7 条）
    ├── concurrency.md                # 六、并发安全（14 条）
    ├── templates-compile-time.md     # 七、模板与编译期（9 条）
    ├── standard-boundary.md          # 八、标准边界与 C++20/23 机制（24 + 11 条）
    ├── type-safety-abi.md            # 九、类型安全与 ABI（13 条）
    └── interface-design.md           # 十、对象语义与接口设计（13 条）
```

检查点按主题分十类逐条整理，每条标注适用标准；各文件末尾单列了尚未覆盖的主题，避免把「没查到」当成「没问题」。

## 作为纯文件 skill 使用

不想装插件时，把 `assets/cpp-opt-audit/` 整个目录复制到 skill 扫描根即可，例如：

- 用户级：`~/.dsh/skills/cpp-opt-audit/`
- 项目级：`<工程根>/.dsh/skills/cpp-opt-audit/`

目录名即 skill 名，`SKILL.md` 的 frontmatter 会被自动解析。

## 开发

本包是 Host-only bundle：零运行时依赖、无构建步骤，`index.js` 直接作为入口导出 `apply`/`inject`/`name`。

```bash
node --check index.js                                  # 语法检查
node -e "import('./index.js').then(m => console.log(m.name, m.inject))"
```

插件在 `apply(ctx)` 里用 `ctx.skills.registerProvider(...)` 注册一个提供方，`list()` 解析 `SKILL.md` 的 frontmatter 生成目录条目，`get()` 每次重新读取正文（因此编辑 skill 内容无需重新安装）。

## 发布

```bash
npm publish --access public
```

`package.json` 中的 `repository` 字段请改成你自己的仓库地址。

## 许可

MIT
