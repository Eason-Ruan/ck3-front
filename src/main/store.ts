import { promises as fs } from "fs";
import path from "path";
import { ChatTurn } from "./types";

const DATA_DIR = path.join(process.cwd(), ".chat_store");

async function ensureDir() {
    await fs.mkdir(DATA_DIR, { recursive: true });
}

export class FileChatStore {
    constructor(private namespace = "default") {
    }

    private fileOf(sessionId: string) {
        return path.join(DATA_DIR, `${this.namespace}__${sessionId}.json`);
    }

    async load(sessionId: string): Promise<ChatTurn[]> {
        await ensureDir();
        const f = this.fileOf(sessionId);
        try {
            const raw = await fs.readFile(f, "utf8");
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    async save(sessionId: string, turns: ChatTurn[]) {
        await ensureDir();
        const f = this.fileOf(sessionId);
        await fs.writeFile(f, JSON.stringify(turns, null, 2), "utf8");
    }

    async append(sessionId: string, turn: ChatTurn) {
        const all = await this.load(sessionId);
        all.push(turn);
        await this.save(sessionId, all);
    }
}