/**
 * @chtholly-fan/dsh-cpp-optimization
 *
 * DSH Host 插件：向 skill 注册表注册一个提供方，把随包的 cpp-opt-audit skill
 * 暴露给会话目录与 skill 工具。
 *
 * 设计约束：
 * - 零运行时依赖，不 import DSH 内部包，rank 常量在本文件内定义，避免 npm 安装后解析失败。
 * - skill 正文与 references 全部放在 assets/cpp-opt-audit/ 下，作为目录资源基暴露，
 *   模型可以用文件读取工具直接读取 references/*.md。
 */

import { readFile } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 提供方名称，注册到 ctx.skills 后用于重名裁决与诊断。 */
const PROVIDER_NAME = "cpp-opt-audit";

/** skill 名称，必须为 kebab-case，模型按此名称调用 skill 工具。 */
const SKILL_NAME = "cpp-opt-audit";

/**
 * 随包提供方的 rank。
 * 与 DSH 内置随包 skill 同档（内置 bundledSkillDir 使用 600），
 * 低于项目级（100/200）与用户级（400/500）同名 skill，便于本地覆盖。
 */
const BUNDLED_SKILL_RANK = 600;

/** 资源根目录：assets/cpp-opt-audit/，SKILL.md 与 references/ 都在其下。 */
const RESOURCE_ROOT = fileURLToPath(new URL("./assets/cpp-opt-audit/", import.meta.url));

/** skill 指令文件路径，同时作为候选项的 locator 供加载与文件预览使用。 */
const SKILL_FILE = join(RESOURCE_ROOT, "SKILL.md");

/** skill 的调用策略：模型可用 skill 工具加载，用户也可用 /cpp-opt-audit 调起。 */
const INVOCATION = Object.freeze({
  modelInvocable: true,
  userInvocable: true
});

/**
 * @brief 解析 skill 文件的 YAML frontmatter，取出 description 并剥离头部
 * @param raw skill 文件全文
 * @param path skill 文件路径，仅用于报错定位
 * @return 解析结果，含 description 与去掉 frontmatter 的正文
 * @throw Error 缺少 frontmatter 或缺少 description 时抛出
 * @note 只支持本包自己写入的单行 description，因此不引入 yaml 依赖
 */
function parseSkill(raw, path) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter?.[1] === undefined) {
    throw new Error(`${PROVIDER_NAME}: ${path} has no YAML frontmatter`);
  }

  const description = /^description:[ \t]*(\S.*)$/mu.exec(frontmatter[1]);
  if (description === null) {
    throw new Error(`${PROVIDER_NAME}: ${path} has no description`);
  }

  return {
    description: description[1].trim(),
    content: raw.slice(frontmatter[0].length).trim()
  };
}

/**
 * @brief 校验随包资源是否完整
 * @throw Error 资源目录或 SKILL.md 缺失时抛出，避免注册一个永远加载不了的 skill
 */
function assertAssets() {
  if (!statSync(RESOURCE_ROOT).isDirectory()) {
    throw new Error(`${PROVIDER_NAME}: expected assets/cpp-opt-audit/ inside the installed package`);
  }
  if (!statSync(SKILL_FILE).isFile()) {
    throw new Error(`${PROVIDER_NAME}: expected assets/cpp-opt-audit/SKILL.md inside the installed package`);
  }
}

/**
 * @brief 构造目录候选项
 * @param description 从 SKILL.md frontmatter 解析出的描述
 * @return 供 skill 注册表合并与展示的候选项
 */
function createCandidate(description) {
  return {
    name: SKILL_NAME,
    description,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: "bundled",
    rank: BUNDLED_SKILL_RANK,
    resourceBase: {
      kind: "directory",
      path: RESOURCE_ROOT
    },
    locator: SKILL_FILE
  };
}

/** 本地文件系统提供方：list 只解析目录条目，get 每次都重新读取当前正文。 */
const provider = {
  name: PROVIDER_NAME,

  /**
   * @brief 列出本提供方提供的 skill
   * @return 只含一个 cpp-opt-audit 的候选项数组
   */
  list() {
    const raw = readFileSync(SKILL_FILE, "utf8");
    return Promise.resolve([createCandidate(parseSkill(raw, SKILL_FILE).description)]);
  },

  /**
   * @brief 加载所选 skill 的完整指令正文
   * @param candidate 由 list 返回并由注册表选中的候选项
   * @param options 加载选项，含中止信号
   * @return 定义对象，正文为去掉 frontmatter 的当前文件内容
   */
  async get(candidate, options) {
    const { locator, rank: _rank, ...summary } = candidate ?? createCandidate("");
    const path = typeof locator === "string" ? locator : SKILL_FILE;
    const raw = await readFile(path, { encoding: "utf8", signal: options?.signal });
    return { ...summary, content: parseSkill(raw, path).content };
  }
};

/** Cordis 插件名，需与 cordis.patch.yml 中的 id 语义一致。 */
const name = "cpp-opt-audit";

/** 本插件依赖的服务：skill 注册表。 */
const inject = ["skills"];

/**
 * @brief 注册 cpp-opt-audit skill 提供方
 * @param ctx 携带 skills 注册表的 Cordis 上下文
 * @return 资源清理函数，用于在插件卸载时移除提供方
 * @throw Error 随包资源缺失或 frontmatter 格式不合法时抛出
 */
function apply(ctx) {
  assertAssets();

  // 激活期先解析一次：frontmatter 写坏时立刻报错，而不是等到首次列出目录。
  parseSkill(readFileSync(SKILL_FILE, "utf8"), SKILL_FILE);

  const dispose = ctx.skills.registerProvider(() => provider);

  return () => {
    if (typeof dispose === "function") {
      dispose();
    }
  };
}

export { apply, inject, name };
