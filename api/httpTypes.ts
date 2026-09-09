export type ApiQueryValue = string | string[] | undefined;

export interface ApiRequest {
  method?: string;
  query: Record<string, ApiQueryValue>;
}

export interface ApiResponse {
  setHeader(name: string, value: string | readonly string[]): void;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
}
