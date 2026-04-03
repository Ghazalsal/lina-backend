import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, "../../data");

export class JsonDB<T extends { id: string | number }> {
  private filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(DATA_DIR, fileName);
  }

  private async ensureDir() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  async getAll(): Promise<T[]> {
    await this.ensureDir();
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveAll(data: T[]): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async getById(id: string | number): Promise<T | undefined> {
    const all = await this.getAll();
    return all.find((item) => String(item.id) === String(id));
  }

  async create(item: Omit<T, "id">): Promise<T> {
    const all = await this.getAll();
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const newItem = { ...item, id: newId } as unknown as T;
    all.push(newItem);
    await this.saveAll(all);
    return newItem;
  }

  async update(id: string | number, updates: Partial<T>): Promise<T | undefined> {
    const all = await this.getAll();
    const index = all.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return undefined;

    all[index] = { ...all[index], ...updates };
    await this.saveAll(all);
    return all[index];
  }

  async delete(id: string | number): Promise<boolean> {
    const all = await this.getAll();
    const initialLength = all.length;
    const filtered = all.filter((item) => String(item.id) !== String(id));
    if (filtered.length === initialLength) return false;

    await this.saveAll(filtered);
    return true;
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAll();
    return all.filter(predicate);
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | undefined> {
    const all = await this.getAll();
    return all.find(predicate);
  }
}
