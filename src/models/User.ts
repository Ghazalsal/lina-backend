import { JsonDB } from "../utils/JsonDB.js";

export interface User {
  id: string;
  name: string;
  phone: string;
  appointments: string[]; // List of appointment IDs
  createdAt?: string;
  updatedAt?: string;
}

export const usersDB = new JsonDB<User>("users.json");
