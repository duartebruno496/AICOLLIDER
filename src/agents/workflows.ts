export function workflowYaml(kind: "static" | "node-api", opts: { name?: string; nodeVersion?: string; buildCmd?: string } = {}): string {
  const name = opts.name ?? "aicollider-deploy";
  const node = opts.nodeVersion ?? "20";
  const build = opts.buildCmd ?? "npm ci && npm run build";

  if (kind === "static") {
    return `name: ${name}-static-deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${node}
          cache: npm
      - name: Install & Build
        run: ${build}
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
  }

  return `name: ${name}-ci
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${node}
          cache: npm
      - name: Install dependencies
        run: ${build.replace(/ && .*$/, "")}
      - name: Build
        run: npm run build
      - name: Run checks
        run: npm run lint || true
`;
}