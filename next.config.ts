import type { NextConfig } from "next";

const config: NextConfig = {
  // the Docker image runs .next/standalone; Vercel and `next start` do not need it
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // the plagiarism form posts a file; only its name is kept (upload is simulated)
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // client router cache: a page seen or prefetched (prefetch={true}) is reused instead of refetched,
    // so Back / Close / reopening a section is instant. Server actions (revalidatePath) still clear it.
    staleTimes: { dynamic: 30, static: 180 },
  },
  poweredByHeader: false,
  // one-tap certificates read the Golos Text TTF at runtime (lib/pdf.ts): ship it with the server functions
  outputFileTracingIncludes: { "/**/*": ["./assets/fonts/*"] },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default config;
