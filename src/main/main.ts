import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { loadEnv } from './config';
import dotenv from "dotenv";

dotenv.config();

function extractTextFromContent(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  // LangChain 可能返回 [{ type: 'text', text: '...' }, ...]
  if (Array.isArray(content)) {
    try {
      const parts = content
        .map((p: any) => {
          if (!p) return "";
          if (typeof p === "string") return p;
          if (typeof p.text === "string") return p.text;
          if (typeof p.content === "string") return p.content;
          return typeof p === "object" ? JSON.stringify(p) : String(p);
        })
        .filter(Boolean);
      return parts.join("\n");
    } catch {
      // 兜底为字符串
      return String(content);
    }
  }
  if (typeof content === "object") {
    // 若是结构化对象，优先常见字段
    const possible = (content as any);
    if (typeof possible.text === "string") return possible.text;
    if (typeof possible.message === "string") return possible.message;
    if (typeof possible.reply === "string") return possible.reply;
    try { return JSON.stringify(content); } catch { return String(content); }
  }
  return String(content);
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    frame: false,
    fullscreen: false,
    transparent: true,
    backgroundColor: '#00000000',
    // 在 Windows 上置顶
    alwaysOnTop: process.platform === 'win32',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      devTools: true
    },
    show: false
  });

  const indexHtmlPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexHtmlPath).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to load index.html:', err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 再次确保置顶（运行时设置），仅在 Windows 生效
  if (process.platform === 'win32') {
    try {
      // 使用更高置顶等级，确保覆盖大多数窗口
      (mainWindow as any).setAlwaysOnTop(true, 'screen-saver');
    } catch {}
  }
}

app.whenReady().then(() => {
  createMainWindow();

  // —— 简单的会话状态：sessionId -> GraphState ——
  const env = loadEnv(process.env);
  // —— 设置/校验 Agent 所需的 Keys ——
  // 优先使用现有环境变量；其次使用经过 Schema 校验后的 env 值
  if (!process.env.RAG_TIER && (env as any)?.RAG_TIER) {
    process.env.RAG_TIER = (env as any).RAG_TIER as string;
  }
  if (!process.env.TAVILY_API_KEY && (env as any)?.TAVILY_API_KEY) {
    process.env.TAVILY_API_KEY = (env as any).TAVILY_API_KEY as string;
  }
  if (!process.env.OPENAI_BASE_URL && (env as any)?.OPENAI_BASE_URL) {
    process.env.OPENAI_BASE_URL = (env as any).OPENAI_BASE_URL as string;
  }
  // OpenAI 相关：ChatOpenAI 与 OpenAIEmbeddings 均依赖 OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[keys] 缺少 OPENAI_API_KEY：OpenAI 模型与向量检索将不可用。');
  }
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[keys] 缺少 TAVILY_API_KEY：tavily_search 工具将不可用。');
  }
  if (process.env.OPENAI_BASE_URL) {
    console.log(`[keys] 使用自定义 OPENAI_BASE_URL=${process.env.OPENAI_BASE_URL}`);
  }
  const tier = (process.env.RAG_TIER || (env as any)?.RAG_TIER) as string | undefined;
  if (tier && ["1", "2", "3", "4"].includes(tier)) {
    const projectRoot = path.resolve(__dirname, '../../');
    const targetDir = path.join(projectRoot, 'data', `${tier}档`);
    try {
      if (fs.existsSync(targetDir)) {
        process.env.HTML_RAG_DIR = targetDir;
        console.log(`[RAG] 使用 RAG_TIER=${tier}，HTML_RAG_DIR=${targetDir}`);
      } else {
        console.warn(`[RAG] 目录不存在：${targetDir}。保留现有 HTML_RAG_DIR=${process.env.HTML_RAG_DIR || '(未设置)'}。`);
      }
    } catch (e: any) {
      console.warn(`[RAG] 检查目录失败：${e?.message || String(e)}`);
    }

    // 设置 CSV_BASE_DIR 为项目 data 目录，便于按 <tier>.csv 加载
    const dataDir = path.join(projectRoot, 'data');
    process.env.CSV_BASE_DIR = dataDir;
    console.log(`[CSV] CSV_BASE_DIR=${process.env.CSV_BASE_DIR}`);
  }
  // 不再构建/调用外部 agent/graph，改为本地占位实现

  ipcMain.handle('chat:newSession', async () => {
    return { ok: true };
  });

  ipcMain.handle('chat:send', async (_event, { text, mode, tier: tierInput }: { text: string, mode?: 'BOTH' | 'DATA' | 'SUGGESTION', tier?: '1' | '2' | '3' | '4' }) => {
    try {
      // 优先使用页面传入的 mode，其次使用环境变量
      const modeFromEnv = env.INFO_MODE;
      const modeValue = (mode || modeFromEnv) as any;
      const tier = (tierInput || env.RAG_TIER) as any;
      const delay = 2000 + Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, delay));

      // 8 个占位文本（内容留空）
      const TEXT_1_BOTH = `推荐的最优选择：**隆佛特市长**
理由：他没有伯爵领，分封后可直接提升为伯爵，忠诚度将显著提高，同时其当前兵力较低，成为伯爵后难以对国王构成威胁，是最稳妥的封臣扩张对象。

---

### 候选封臣

**隆佛特市长**

* 好感度：37
* 拥有的伯爵领数量：0
* 兵力：69
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：无领地的小封臣，分封后获得巨大好感提升，实力有限，易于控制。

**卡里格阿尔格什市长**

* 好感度：27
* 拥有的伯爵领数量：0
* 兵力：46
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：与隆佛特类似，弱小且无伯爵领，是可行的受封人选，但好感度偏低。

**奥里尔伯爵**

* 好感度：78
* 拥有的伯爵领数量：1
* 兵力：151
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：属于同一家族，好感基础高，增强亲族封臣的地位有利于内部团结，但已有伯爵领，长期可能变强。

**都夫林伯爵**

* 好感度：71
* 拥有的伯爵领数量：1
* 兵力：781
* 信仰：天主教
* 文化：爱尔兰
* 特质：强力封臣，当前好感较高，封地增益会进一步稳固关系，但增强其兵力可能导致未来难以压制。

---

### 决策理由

最优选择是隆佛特市长，因为他弱小无地，分封后获得巨大好感提升，几乎没有威胁，是最佳的“奖励”人选。其他候选如卡里格阿尔格什市长同样合适，但好感稍差；奥里尔伯爵因家族关系可考虑；都夫林伯爵实力过强，虽然稳固短期局势，但有长期隐患。`;
      const TEXT_2_BOTH = `把新的直属伯爵领分封给**威斯特摩兰伯爵**。
理由：他和你同一家族，忠诚度最高，已经有一定地位但权力不算过大。分封能进一步稳固宗族内部关系，减少潜在内乱的风险。

---

### 候选封臣信息

**威斯特摩兰伯爵**

* 好感度：80
* 同一家族：是
* 现有伯爵领：1
* 兵力：98
* 信仰文化：阿萨神族、诺斯
* 亮点：忠诚度高且属于家族，最稳妥的分封对象

**蒂维厄特河谷伯爵**

* 好感度：70
* 同一家族：否
* 现有伯爵领：2
* 兵力：155
* 亮点：对你态度不错，但已有两块伯爵领，再分封可能导致权力过盛

**默恩伯爵**

* 好感度：65
* 同一家族：否
* 现有伯爵领：1
* 兵力：254
* 亮点：兵力强大，拉拢后能增强你的军事力量，但过于强势可能日后难以制衡

**东赖丁伯爵**

* 好感度：25
* 同一家族：否
* 现有伯爵领：1
* 兵力：234
* 亮点：兵力强大，分封可显著提升好感度，但目前态度偏冷淡，存在风险`;
      const TEXT_3_BOTH = `**推荐分封对象：代根多夫市长**
理由：他目前没有伯爵领，若分封会直接升格为伯爵，对好感提升极大；他兵力较低，不会形成威胁；信仰和文化与你一致，治理容易。

---

### 其他较优候选人

**弗赖辛市长**

* 好感度高达85，容易转化为忠诚伯爵
* 无伯爵领，分封效用最大
* 但文化为法兰克尼亚，可能导致轻微的文化摩擦

**因斯布鲁克伯爵**

* 好感度极高，已接近满值
* 已有1块伯爵领，若再授予容易变得过强
* 文化相同，整合顺畅，但风险在于强势贵族

**弗龙滕豪森伯爵**

* 属于你的家族，忠诚度较稳固
* 好感度不错，分封能进一步巩固宗族势力
* 已有伯爵领，强化他会让家族内部一支势力膨胀
`;
      const TEXT_4_BOTH = `推荐的最优选择是：**沃尼察市长**
理由：他目前没有伯爵领，直接授予他一块伯爵领能大幅提升忠诚，同时兵力较低，对你威胁小，容易控制。

---

### 较优候选封臣

**沃尼察市长**

* 好感：-6（中立，可迅速转为积极）
* 现状：没有伯爵领
* 兵力：393，低，不构成威胁
* 优点：授予后直接升为伯爵，忠诚度提升最显著

**什蒂普市长**

* 好感：89，极高的忠诚度
* 现状：没有伯爵领
* 兵力：289，很低，不可能挑战你
* 优点：几乎忠心耿耿，给他领地非常安全
* 缺点：提升空间有限，好感度本就高

**埃托利亚伯爵**

* 好感：55，积极
* 家族：与你同一家族
* 现状：已有1个伯爵领
* 兵力：534，中等
* 优点：家族成员，扩展实力有助于同族势力稳固
* 缺点：已有领地，给他更多领地可能令其势力过强

**斯科普里伯爵**

* 好感：55，积极
* 现状：已有2个伯爵领
* 兵力：976，较强
* 优点：对你有好感，授予会加深忠诚
* 缺点：已有过多领地，继续增强可能导致难以控制
`;
      const TEXT_1_DATA = `### 候选封臣

**隆佛特市长**

* 好感度：37
* 拥有的伯爵领数量：0
* 兵力：69
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：无领地的小封臣，分封后获得巨大好感提升，实力有限，易于控制。

**卡里格阿尔格什市长**

* 好感度：27
* 拥有的伯爵领数量：0
* 兵力：46
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：与隆佛特类似，弱小且无伯爵领，是可行的受封人选，但好感度偏低。

**奥里尔伯爵**

* 好感度：78
* 拥有的伯爵领数量：1
* 兵力：151
* 信仰：海岛基督教
* 文化：爱尔兰
* 特质：属于同一家族，好感基础高，增强亲族封臣的地位有利于内部团结，但已有伯爵领，长期可能变强。

**都夫林伯爵**

* 好感度：71
* 拥有的伯爵领数量：1
* 兵力：781
* 信仰：天主教
* 文化：爱尔兰
* 特质：强力封臣，当前好感较高，封地增益会进一步稳固关系，但增强其兵力可能导致未来难以压制`;
      const TEXT_2_DATA = `### 候选封臣信息

**威斯特摩兰伯爵**

* 好感度：80
* 同一家族：是
* 现有伯爵领：1
* 兵力：98
* 信仰文化：阿萨神族、诺斯
* 亮点：忠诚度高且属于家族，最稳妥的分封对象

**蒂维厄特河谷伯爵**

* 好感度：70
* 同一家族：否
* 现有伯爵领：2
* 兵力：155
* 亮点：对你态度不错，但已有两块伯爵领，再分封可能导致权力过盛

**默恩伯爵**

* 好感度：65
* 同一家族：否
* 现有伯爵领：1
* 兵力：254
* 亮点：兵力强大，拉拢后能增强你的军事力量，但过于强势可能日后难以制衡

**东赖丁伯爵**

* 好感度：25
* 同一家族：否
* 现有伯爵领：1
* 兵力：234
* 亮点：兵力强大，分封可显著提升好感度，但目前态度偏冷淡，存在风险`;
      const TEXT_3_DATA = `### 其他较优候选人

**弗赖辛市长**

* 好感度高达85，容易转化为忠诚伯爵
* 无伯爵领，分封效用最大
* 但文化为法兰克尼亚，可能导致轻微的文化摩擦

**因斯布鲁克伯爵**

* 好感度极高，已接近满值
* 已有1块伯爵领，若再授予容易变得过强
* 文化相同，整合顺畅，但风险在于强势贵族

**弗龙滕豪森伯爵**

* 属于你的家族，忠诚度较稳固
* 好感度不错，分封能进一步巩固宗族势力
* 已有伯爵领，强化他会让家族内部一支势力膨胀`;
      const TEXT_4_DATA = `### 较优候选封臣

**沃尼察市长**

* 好感：-6（中立，可迅速转为积极）
* 现状：没有伯爵领
* 兵力：393，低，不构成威胁
* 优点：授予后直接升为伯爵，忠诚度提升最显著

**什蒂普市长**

* 好感：89，极高的忠诚度
* 现状：没有伯爵领
* 兵力：289，很低，不可能挑战你
* 优点：几乎忠心耿耿，给他领地非常安全
* 缺点：提升空间有限，好感度本就高

**埃托利亚伯爵**

* 好感：55，积极
* 家族：与你同一家族
* 现状：已有1个伯爵领
* 兵力：534，中等
* 优点：家族成员，扩展实力有助于同族势力稳固
* 缺点：已有领地，给他更多领地可能令其势力过强

**斯科普里伯爵**

* 好感：55，积极
* 现状：已有2个伯爵领
* 兵力：976，较强
* 优点：对你有好感，授予会加深忠诚
* 缺点：已有过多领地，继续增强可能导致难以控制`;
      const TEXT_1_SUGGESTION = `推荐的最优选择：**隆佛特市长**
理由：他没有伯爵领，分封后可直接提升为伯爵，忠诚度将显著提高，同时其当前兵力较低，成为伯爵后难以对国王构成威胁，是最稳妥的封臣扩张对象。`;
      const TEXT_2_SUGGESTION = `把新的直属伯爵领分封给**威斯特摩兰伯爵**。
理由：他和你同一家族，忠诚度最高，已经有一定地位但权力不算过大。分封能进一步稳固宗族内部关系，减少潜在内乱的风险。`;
      const TEXT_3_SUGGESTION = `**推荐分封对象：代根多夫市长**
理由：他目前没有伯爵领，若分封会直接升格为伯爵，对好感提升极大；他兵力较低，不会形成威胁；信仰和文化与你一致，治理容易。`;
      const TEXT_4_SUGGESTION = `推荐的最优选择是：**沃尼察市长**
理由：他目前没有伯爵领，直接授予他一块伯爵领能大幅提升忠诚，同时兵力较低，对你威胁小，容易控制。`;

      function pickBy(modeValue: string | undefined, tierValue: string | undefined): string {
        switch (modeValue) {
          case 'DATA':
            switch (tier) {
              case '1': return TEXT_1_DATA;
              case '2': return TEXT_2_DATA;
              case '3': return TEXT_3_DATA;
              case '4': return TEXT_4_DATA;
              default:  return '';
            }
          case 'SUGGESTION':
            switch (tier) {
              case '1': return TEXT_1_SUGGESTION;
              case '2': return TEXT_2_SUGGESTION;
              case '3': return TEXT_3_SUGGESTION;
              case '4': return TEXT_4_SUGGESTION;
              default:  return '';
            }
          case 'BOTH':
            switch (tier) {
              case '1': return TEXT_1_BOTH;
              case '2': return TEXT_2_BOTH;
              case '3': return TEXT_3_BOTH;
              case '4': return TEXT_4_BOTH;
              default:  return '';
            }
          default:
            return '';
        }
      }

      const reply = pickBy(modeValue as any, tier as any);
      return { reply };
    } catch (error: any) {
      const message = (error && error.message) ? error.message : String(error);
      return { reply: `处理失败：${message}` };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


