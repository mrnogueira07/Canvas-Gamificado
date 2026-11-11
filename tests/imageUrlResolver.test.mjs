import fs from "node:fs";
import ts from "typescript";
import test from "node:test";
import assert from "node:assert/strict";

const js = ts.transpile(fs.readFileSync("src/lib/imageUrlResolver.ts", "utf8"), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const api = {};
new Function("exports", js)(api);
const {
  parseReferenceImageEntry,
  resolveCanvasImageUrl,
  getCanvasImageCandidates,
} = api;

test("resolves Shutterstock webpage links from old canvases to direct CDN JPEG URLs", () => {
  const shutterstockPageUrl =
    "https://www.shutterstock.com/pt/image-vector/hard-worker-pushes-big-box-service-1932040058?trackingId=49351903-2252-4194-9031-62c170294444&listId=searchResults";

  const resolved = resolveCanvasImageUrl(shutterstockPageUrl);
  assert.equal(
    resolved,
    "https://www.shutterstock.com/image-vector/hard-worker-pushes-big-box-service-600nw-1932040058.jpg"
  );

  const candidates = getCanvasImageCandidates(shutterstockPageUrl);
  assert.ok(
    candidates.includes(
      "https://www.shutterstock.com/image-vector/hard-worker-pushes-big-box-service-600nw-1932040058.jpg"
    )
  );
  assert.ok(
    candidates.includes(
      "https://www.shutterstock.com/image-vector/hard-worker-pushes-big-box-service-260nw-1932040058.jpg"
    )
  );
  assert.ok(
    candidates.includes(
      "https://www.shutterstock.com/image-photo/stock-600nw-1932040058.jpg"
    )
  );
  assert.ok(candidates.some((c) => c.startsWith("https://wsrv.nl/?url=")));
});

test("resolves Google Images, Google Drive, Wikipedia, Unsplash, Pexels, Imgur and Dropbox links", () => {
  // Google Images redirect containing a Shutterstock page link
  const googleImgRes =
    "https://www.google.com/imgres?imgurl=" +
    encodeURIComponent(
      "https://www.shutterstock.com/pt/image-vector/hard-worker-pushes-big-box-service-1932040058"
    ) +
    "&imgrefurl=https://www.shutterstock.com";
  assert.equal(
    resolveCanvasImageUrl(googleImgRes),
    "https://www.shutterstock.com/image-vector/hard-worker-pushes-big-box-service-600nw-1932040058.jpg"
  );

  // Google Drive file view
  assert.equal(
    resolveCanvasImageUrl(
      "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing"
    ),
    "https://drive.google.com/thumbnail?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms&sz=w1200"
  );

  // Wikipedia media hash
  assert.equal(
    resolveCanvasImageUrl(
      "https://pt.wikipedia.org/wiki/For%C3%A7a#/media/Ficheiro:Force_examples.svg"
    ),
    "https://commons.wikimedia.org/wiki/Special:FilePath/Force_examples.svg?width=1000"
  );

  // Pexels photo page
  assert.equal(
    resolveCanvasImageUrl(
      "https://www.pexels.com/pt-br/foto/cientista-no-laboratorio-256262/"
    ),
    "https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=900"
  );

  // Imgur page
  assert.equal(
    resolveCanvasImageUrl("https://imgur.com/abc1234"),
    "https://i.imgur.com/abc1234.jpg"
  );

  // Dropbox link
  assert.equal(
    resolveCanvasImageUrl("https://www.dropbox.com/s/xyz123/foto.png?dl=0"),
    "https://www.dropbox.com/s/xyz123/foto.png?raw=1"
  );
});

test("parseReferenceImageEntry handles JSON strings, legacy objects, and raw URLs", () => {
  const fromJson = parseReferenceImageEntry(
    JSON.stringify({
      src: "https://www.shutterstock.com/pt/image-vector/hard-worker-pushes-big-box-service-1932040058",
      ratio: "3:5",
      description: "Força Aplicada",
    })
  );
  assert.deepEqual(fromJson, {
    src: "https://www.shutterstock.com/pt/image-vector/hard-worker-pushes-big-box-service-1932040058",
    ratio: "3:5",
    description: "Força Aplicada",
  });

  const fromLegacyObj = parseReferenceImageEntry({
    url: "https://example.com/a.jpg",
    desc: "Legenda antiga",
  });
  assert.deepEqual(fromLegacyObj, {
    src: "https://example.com/a.jpg",
    ratio: "16:9",
    description: "Legenda antiga",
  });

  const fromRawUrl = parseReferenceImageEntry("https://example.com/raw.png");
  assert.deepEqual(fromRawUrl, {
    src: "https://example.com/raw.png",
    ratio: "16:9",
    description: "",
  });
});
