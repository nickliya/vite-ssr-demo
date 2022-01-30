import { createApp } from "./main";
import { renderToString, SSRContext } from "vue/server-renderer";
import { basename } from "path";
import { setup } from "@css-render/vue3-ssr";

export async function render(url: string, manifest: Record<string, string[]>) {
  const { app, router } = createApp();

  // set the router to the desired URL before rendering
  router.push(url);
  await router.isReady();

  // passing SSR context object which will be available via useSSRContext()
  // @vitejs/plugin-vue injects code into a component's setup() that registers
  // itself on ctx.modules. After the render, ctx.modules would contain all the
  // components that have been instantiated during this render call.
  const ctx: SSRContext = {};
  const appHtml = await renderToString(app, ctx);
  const { collect } = setup(app);
  const cssHtml = collect();

  // the SSR manifest generated by Vite contains module -> chunk/asset mapping
  // which we can then use to determine what files need to be preloaded for this
  // request.
  const preloadLinks = renderPreloadLinks(ctx.modules, manifest);

  return { appHtml, cssHtml, preloadLinks };
}

function renderPreloadLinks(
  modules: Set<string>,
  manifest: Record<string, string[]>
) {
  let links = "";
  const seen = new Set();
  [...modules].map((id) => {
    const files = manifest[id];
    if (files) {
      files.map((file) => {
        if (!seen.has(file)) {
          seen.add(file);
          const filename = basename(file);
          if (manifest[filename]) {
            manifest[filename].map((depFile) => {
              links += renderPreloadLink(depFile);
              seen.add(depFile);
            });
          }

          links += renderPreloadLink(file);
        }
      });
    }
  });
  return links;
}

function renderPreloadLink(file: string) {
  if (file.endsWith(".js")) {
    return `<link rel="modulepreload" crossorigin href="${file}">`;
  } else if (file.endsWith(".css")) {
    return `<link rel="stylesheet" href="${file}">`;
  } else if (file.endsWith(".woff")) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`;
  } else if (file.endsWith(".woff2")) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
  } else if (file.endsWith(".gif")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/gif">`;
  } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/jpeg">`;
  } else if (file.endsWith(".png")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/png">`;
  } else {
    // TODO
    return "";
  }
}
