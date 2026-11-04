export function connectionOptions(url: string): {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: false | "require";
};
