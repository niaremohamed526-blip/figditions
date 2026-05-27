// Server-only helpers for CloudConvert API.
// Never import this file from client code.

const CC_BASE = "https://api.cloudconvert.com/v2";

function token() {
  const t = process.env.CLOUDCONVERT_API_KEY;
  if (!t) throw new Error("CLOUDCONVERT_API_KEY is not configured");
  return t;
}

export type CCFormat = "epub" | "mobi";

export interface CreateJobInput {
  sourceUrl: string;
  sourceFormat: "pdf" | "docx" | "txt";
  targets: CCFormat[];
  metadata: {
    titre: string;
    auteur: string;
  };
}

export interface CCJob {
  id: string;
  status: "waiting" | "processing" | "finished" | "error";
  tasks: CCTask[];
}

export interface CCTask {
  id: string;
  name: string;
  operation: string;
  status: "waiting" | "processing" | "finished" | "error";
  message?: string;
  result?: { files?: { filename: string; url: string }[] };
}

export async function createJob(input: CreateJobInput): Promise<CCJob> {
  const tasks: Record<string, unknown> = {
    "import-source": { operation: "import/url", url: input.sourceUrl },
  };
  for (const fmt of input.targets) {
    tasks[`convert-${fmt}`] = {
      operation: "convert",
      input: "import-source",
      input_format: input.sourceFormat,
      output_format: fmt,
      filename: `${input.metadata.titre.replace(/[^a-z0-9\-_ ]/gi, "_").slice(0, 60) || "ebook"}.${fmt}`,
    };
    tasks[`export-${fmt}`] = {
      operation: "export/url",
      input: `convert-${fmt}`,
      inline: false,
      archive_multiple_files: false,
    };
  }

  const res = await fetch(`${CC_BASE}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tasks }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`CloudConvert createJob failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { data: CCJob };
  return json.data;
}

export async function getJob(jobId: string): Promise<CCJob> {
  const res = await fetch(`${CC_BASE}/jobs/${jobId}?include=tasks`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`CloudConvert getJob failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { data: CCJob };
  return json.data;
}

export function exportedFileFor(job: CCJob, fmt: CCFormat): { filename: string; url: string } | null {
  const task = job.tasks.find((t) => t.name === `export-${fmt}` && t.status === "finished");
  const file = task?.result?.files?.[0];
  return file ? { filename: file.filename, url: file.url } : null;
}
