import JSZip from "jszip";
import type { StudioProject, StudioSlide } from "./studioProjects";
import { studioFilename } from "./studioProjects";
import { orderedStudioSlides } from "./studioNavigation";
import { resolveImageAsBlob } from "./studioImages";

const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);
const all = (node: Document | Element, ns: string, name: string) => Array.from(node.getElementsByTagNameNS(ns, name));
const cleanText = (text: string) => Array.from(text).filter(c => c.charCodeAt(0) >= 32 || "\t\n\r".includes(c)).join("");
const escape = (text: string) => cleanText(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emu = (inches: number) => Math.round(inches * 914400);

type Style = { font: string; titleFont: string; titleSize: number; bodySize: number; color: string; x: number; y: number; w: number; h: number };
const styles: Record<string, Style> = {
  "Konecta Kids": { font: "Montserrat Medium", titleFont: "Montserrat Medium", titleSize: 80, bodySize: 80, color: "571075", x: 2.73, y: 3.8, w: 36, h: 20 },
  "Konectar.me": { font: "Montserrat Medium", titleFont: "Montserrat Medium", titleSize: 80, bodySize: 80, color: "2796E1", x: 3, y: 3, w: 36, h: 23 },
  "Educação Corporativa": { font: "Montserrat Medium", titleFont: "Montserrat Medium", titleSize: 28, bodySize: 18, color: "03153D", x: .6, y: .6, w: 8.9, h: 5.7 },
};

// Native editable text. Artwork, masters, theme and embedded fonts stay in the template ZIP.
function addText(
  doc: Document,
  id: number,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font: string,
  initialSize: number,
  color: string,
  bold = false,
  align: "l" | "r" | "ctr" | "just" = "just"
) {
  if (text.length > 4000) {
    throw new Error("O texto de um slide excede o espaço da área útil. Divida o conteúdo em mais slides.");
  }
  let size = initialSize;
  const maxHeight = h * 72 - 4;
  // Permite auto-correção reduzindo a fonte suavemente apenas se não for o tamanho padrão fixo de 80pt
  const minSize = Math.max(12, Math.round(initialSize * 0.35));

  const calculateHeight = (s: number) => {
    const capacity = Math.max(1, Math.floor((w * 72 - 15) / (s * 0.64)));
    return text.split(/\r?\n/).reduce(
      (sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / capacity)) * s * 1.15 + s * 0.35,
      0
    ) - s * 0.35;
  };

  // Mantém estritamente 80pt quando solicitado; reduz suavemente apenas para tamanhos livres que excederem o espaço
  if (initialSize !== 80) {
    while (size > minSize && calculateHeight(size) > maxHeight) {
      size -= 2;
    }
  }

  // Gera parágrafos com o alinhamento especificado (justificado por padrão para corpo de texto)
  const paragraphs = text.split(/\r?\n/).map(line =>
    `<a:p><a:pPr algn="${align}"><a:lnSpc><a:spcPct val="115000"/></a:lnSpc><a:spcAft><a:spcPts val="${Math.round(size * 35)}"/></a:spcAft><a:buNone/></a:pPr><a:r><a:rPr lang="pt-BR" sz="${Math.round(size * 100)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/><a:sym typeface="${font}"/></a:rPr><a:t xml:space="preserve">${escape(line)}</a:t></a:r><a:endParaRPr lang="pt-BR" sz="${Math.round(size * 100)}"><a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/><a:sym typeface="${font}"/></a:endParaRPr></a:p>`
  ).join("");

  const fragment = parse(`<p:sp xmlns:p="${P}" xmlns:a="${A}"><p:nvSpPr><p:cNvPr id="${id}" name="Conteúdo ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91425" tIns="45700" rIns="91425" bIns="45700"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`);
  if (bold) all(fragment, A, "rPr").forEach(node => node.setAttribute("b", "1"));
  all(doc, P, "spTree")[0].appendChild(doc.importNode(fragment.documentElement, true));
}

function fillExisting(shape: Element, value: string) {
  const texts = all(shape, A, "t");
  texts.forEach((node, index) => { node.textContent = index === 0 ? value : ""; });
}

function separator(doc: Document, id: number, x: number, y: number, w: number, h: number, color: string, outline: boolean) {
  const shape = parse(`<p:sp xmlns:p="${P}" xmlns:a="${A}"><p:nvSpPr><p:cNvPr id="${id}" name="Separador ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${outline ? `<a:noFill/><a:ln w="127000"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln>` : `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln>`}</p:spPr></p:sp>`);
  all(doc, P, "spTree")[0].appendChild(doc.importNode(shape.documentElement, true));
}

function addPicture(doc: Document, id: number, relationship: string, x: number, y: number, width: number, height: number, description: string) {
  const shape = parse(`<p:pic xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:nvPicPr><p:cNvPr id="${id}" name="Ilustração ${id}" descr="${escape(description)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationship}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
  all(doc, P, "spTree")[0].appendChild(doc.importNode(shape.documentElement, true));
}

function fillSlide(xml: string, slide: StudioSlide, project: StudioProject, picture?: { relationship: string; ratio: number }): string {
  if (slide.type === "encerramento") return xml;
  const doc = parse(xml);
  const line = project.line || "Konectar.me";
  const style = styles[line];
  const highlight = line === "Konecta Kids" && ["gancho", "resumo", "exercicio"].includes(slide.type || "");
  const shapes = all(doc, P, "sp").filter(shape => all(shape, P, "txBody").length);
  if (line === "Konecta Kids" && slide.type === "capa") {
    if ((project.teacher || "").length > 65 || (project.title || slide.title).length > 110) throw new Error("Encurte o nome do professor (até 65 caracteres) ou o tema (até 110) para caber na capa Konecta Kids.");
    const fields = shapes.filter(shape => all(shape, A, "t").length);
    fillExisting(fields[0], project.teacher || "Professor(a) a definir");
    fillExisting(fields[1], slide.title || project.title);
    // Keep the original positions and typeface; allow two lines inside the white panel.
    fields.forEach((field, index) => {
      const ext = all(field, A, "ext")[0];
      ext?.setAttribute("cy", String(emu(index === 0 ? 2 : 3.5)));
      const body = all(field, A, "bodyPr")[0];
      all(body, A, "spAutoFit").forEach(node => node.parentNode?.removeChild(node));
      body.appendChild(doc.createElementNS(A, "a:noAutofit"));
    });
    return serialize(doc);
  }
  shapes.forEach(shape => shape.parentNode?.removeChild(shape));
  let id = Math.max(1, ...all(doc, P, "cNvPr").map(node => Number(node.getAttribute("id")) || 0)) + 1;
  const text = (value: string, y: number, h: number, title = false) => addText(doc, id++, value, style.x, y, style.w, h, title ? style.titleFont : style.font, title ? style.titleSize : style.bodySize, highlight ? "FFFFFF" : title ? style.color : "000000", false, title ? "l" : "just");
  if (slide.type === "capa") {
    if (line === "Educação Corporativa") {
      addText(doc, id++, slide.title || project.title, .6, 2.7, 9, 1.2, style.font, 28, "6FAADB", true, "l");
      addText(doc, id++, project.subtitle || "", .6, 4, 9, 1.2, style.font, 18, "FFFFFF", false, "l");
    } else {
      // Preserve the template origins and keep the right edge outside the safety area.
      addText(doc, id++, "Tema da aula:", 11.5, 8.7, 27.5, 2.2, style.titleFont, 80, "257CE1", false, "l");
      addText(doc, id++, slide.title || project.title, 11.5, 11.0, 27.5, 5, style.font, 80, "000000", false, "l");
      addText(doc, id++, "Disciplina:", 11.5, 16.8, 27.5, 2.2, style.titleFont, 80, "257CE1", false, "l");
      addText(doc, id++, project.subject, 11.5, 19.1, 27.5, 4, style.font, 80, "000000", false, "l");
    }
  } else if (slide.type === "objetivo_bncc") {
    const corporate = line === "Educação Corporativa";
    text(line === "Konectar.me" ? "OBJETIVO" : "Objetivo:", style.y, corporate ? .55 : 2, true);
    text(slide.objective || project.objective, style.y + (corporate ? .7 : 2.4), corporate ? 1.65 : 5.5);
    text(corporate ? "Competência desenvolvida:" : line === "Konectar.me" ? "HABILIDADE BNCC" : "Habilidade da BNCC:", style.y + (corporate ? 2.7 : 9), corporate ? .55 : 2, true);
    text(slide.skills?.join("\n") || slide.curriculum || project.curriculum || (corporate ? "Competência a definir" : "[VALIDAR BNCC]"), style.y + (corporate ? 3.4 : 11.5), corporate ? 2 : 8);
  } else {
    const titleHeight = line === "Educação Corporativa" ? 1.1 : 4;
    text(slide.title, style.y, titleHeight, true);
    const bodyY = style.y + titleHeight + (line === "Educação Corporativa" ? .25 : .8);
    const bodyH = style.h - titleHeight - 1;
    if (slide.type === "exercicio") {
      let question = (slide.exerciseQuestion || "").trim();
      let options = slide.alternatives?.length ? [...slide.alternatives] : [];
      if (!question || !options.length) {
        const lines = (slide.content || "").split("\n").map(l => l.trim()).filter(Boolean);
        const firstOpt = lines.findIndex(l => /^[A-Za-z0-9]\s*[).-]\s+/.test(l));
        if (firstOpt !== -1) {
          if (!question) question = lines.slice(0, firstOpt).join(" ").trim();
          if (!options.length) {
            let curLabel = "", curText = "";
            for (let i = firstOpt; i < lines.length; i++) {
              const m = lines[i].match(/^([A-Za-z0-9])\s*[).-]\s+(.*)$/);
              if (m) {
                if (curLabel) options.push({ label: curLabel, text: curText.trim(), correct: false });
                curLabel = m[1].toUpperCase(); curText = m[2];
              } else if (curLabel) curText += " " + lines[i];
            }
            if (curLabel) options.push({ label: curLabel, text: curText.trim(), correct: false });
          }
        } else {
          if (!question) question = lines[0] || "Questão pendente de inclusão pelo professor.";
          if (!options.length && lines.length > 1) {
            options = lines.slice(1).map((l, idx) => ({ label: String.fromCharCode(65 + idx), text: l, correct: false }));
          }
        }
      }
      if (!question) question = "Questão pendente de inclusão pelo professor.";
      const qH = Math.min(3.2, Math.max(1.5, bodyH * (options.length >= 5 ? 0.22 : 0.28)));
      addText(doc, id++, question, style.x, bodyY, style.w, qH, style.font, style.bodySize, "000000", false, "just");
      const gap = options.length >= 5 ? 0.25 : 0.38;
      const optsAreaY = bodyY + qH + 0.2;
      const optsAreaH = bodyH - qH - 0.3;
      const rowH = Math.min(2.8, (optsAreaH - gap * Math.max(0, options.length - 1)) / Math.max(1, options.length));
      options.forEach((option, index) => {
        const y = optsAreaY + index * (rowH + gap);
        separator(doc, id++, style.x, y, style.w, rowH, "9BBBD1", true);
        addText(doc, id++, `${option.label}) ${option.text}`, style.x + 0.3, y + 0.1, style.w - 0.6, rowH - 0.2, style.font, style.bodySize, "000000", false, "just");
      });
    } else if (slide.type === "gabarito") {
      let correct = slide.alternatives?.find(option => option.correct);
      if (!correct && project.slides?.length) {
        for (const s of project.slides) {
          if (s.type === "exercicio" && s.alternatives?.length) {
            const found = s.alternatives.find(opt => opt.correct);
            if (found) { correct = found; break; }
          }
        }
      }
      let answerText = correct ? `${correct.label}) ${correct.text}` : "";
      let justText = (slide.justification || "").trim();
      if (!answerText || !justText) {
        const lines = (slide.content || "").split("\n").map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!answerText && /^(resposta|gabarito|alternativa\s+correta)/i.test(line)) answerText = line;
          else if (!justText && /^(justificativa|coment[aá]rio|resolu[cç][aã]o):?\s*/i.test(line)) justText = line.replace(/^(justificativa|coment[aá]rio|resolu[cç][aã]o):?\s*/i, "");
        }
        if (!answerText && lines.length > 0) answerText = lines[0];
        if (!justText && lines.length > 1) justText = lines.slice(1).join("\n");
      }
      if (!answerText) answerText = "Resposta comentada";
      addText(doc, id++, answerText.startsWith("Resposta") ? answerText : `Resposta correta: ${answerText}`, style.x, bodyY, style.w, 2.5, style.font, style.bodySize, "03153D", false, "l");
      if (justText) {
        addText(doc, id++, justText, style.x, bodyY + 3.0, style.w, Math.max(3, bodyH - 3.2), style.font, style.bodySize, "000000", false, "just");
      }
    } else if (slide.layout === "comparacao" && slide.columns?.length) {
      const gap = .8;
      const width = (style.w - gap) / Math.min(2, slide.columns.length);
      slide.columns.slice(0, 2).forEach((column, index) => {
        const x = style.x + index * (width + gap);
        addText(doc, id++, column.title, x, bodyY, width, 2, style.titleFont, style.bodySize, style.color, false, "l");
        const rowH = (bodyH - 2.8) / Math.max(1, column.items.length);
        column.items.slice(0, 3).forEach((item, row) => addText(doc, id++, item, x, bodyY + 2.5 + row * rowH, width, rowH - .2, style.font, style.bodySize, "000000", false, "just"));
      });

    } else if ((slide.layout === "linha_do_tempo" || slide.layout === "processo") && slide.timelineItems?.length) {
      const items = slide.timelineItems.slice(0, 6);
      const gap = .35;
      const width = (style.w - gap * (items.length - 1)) / items.length;
      items.forEach((item, index) => {
        const x = style.x + index * (width + gap);
        separator(doc, id++, x, bodyY, width, .12, ["2796E1", "F79646", "7030A0", "9BBB59"][index % 4], false);
        addText(doc, id++, item.label, x, bodyY + .45, width, 2.5, style.titleFont, style.bodySize, style.color, false, "l");
        if (item.text) addText(doc, id++, item.text, x, bodyY + 3, width, Math.max(2, bodyH - 3), style.font, style.bodySize, "000000", false, "just");
      });
    } else if (slide.type === "formula" || slide.layout === "formula_com_espaco" || slide.layout === "formula") {
      addText(doc, id++, slide.formula || slide.content, style.x, bodyY, style.w, bodyH * .35, style.font, style.bodySize, highlight ? "FFFFFF" : "000000", false, "just");
    } else if ((["imagem_esquerda_texto_direita", "topicos_com_imagem"].includes(slide.layout || "") || picture) && (slide.image?.description || slide.image?.url)) {
      const imageW = style.w * .46;
      const sourceSize = line === "Educação Corporativa" ? 10 : 40;
      const imgShift = Math.max(0, Math.min(bodyH - 2, ((slide.imageOffsetY || 0) / 56.25) * bodyH));
      const textShift = Math.max(0, Math.min(bodyH - 2, ((slide.textOffsetY || 0) / 56.25) * bodyH));
      const imageH = Math.max(1.5, bodyH - 1.2 - imgShift);
      if (picture) {
        addPicture(doc, id++, picture.relationship, style.x, bodyY + imgShift, imageW, imageH, slide.image.description || slide.title);
      } else {
        addText(doc, id++, `[BUSCAR IMAGEM]\n${slide.image.description || slide.title}`, style.x, bodyY + imgShift, imageW, imageH, style.font, style.bodySize, highlight ? "FFFFFF" : "000000", false, "l");
      }
      const imageCredit = slide.image.source || "Fonte não informada";
      const imagePage = slide.image.page && !imageCredit.includes(`p. ${slide.image.page}`) ? ` · p. ${slide.image.page}` : "";
      addText(doc, id++, `${slide.image.caption ? `${slide.image.caption} · ` : ""}${imageCredit}${imagePage}`, style.x, bodyY + imageH + 0.15 + imgShift, imageW, 0.9, style.font, sourceSize, highlight ? "FFFFFF" : "000000", false, "ctr");
      addText(doc, id++, slide.content, style.x + imageW + style.w * .04, bodyY + textShift, style.w * .50, Math.max(1.5, bodyH - textShift), style.font, style.bodySize, highlight ? "FFFFFF" : "000000", false, "just");
    } else if (["topicos_com_barras", "caixas_contorno", "topicos", "mapa_resumo"].includes(slide.layout || "") && slide.content.trim()) {
      const items = slide.content.split("\n").filter(Boolean);
      const corporate = line === "Educação Corporativa";
      const gap = corporate ? .15 : .5;
      const rowH = (bodyH - gap * (items.length - 1)) / items.length;
      const colors = line === "Konecta Kids" ? ["993DBC", "32DAC3", "FFC500", "FE647C"] : corporate ? ["6FAADB", "03153D"] : ["F79646", "7030A0", "9BBB59"];
      items.forEach((item, index) => {
        const y = bodyY + index * (rowH + gap);
        const outline = slide.layout === "caixas_contorno";
        const inset = corporate ? .2 : .8;
        separator(doc, id++, style.x, y, outline ? style.w : corporate ? .05 : .2, rowH, colors[index % colors.length], outline);
        addText(doc, id++, item, style.x + inset, y + gap * .2, style.w - inset * 2, rowH - gap * .4, style.font, style.bodySize, highlight ? "FFFFFF" : "000000", false, "just");
      });
    } else text(slide.content, bodyY, bodyH);
  }
  return serialize(doc);
}

function notesXml(notes: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notas"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${notes.split("\n").map(line => `<a:p><a:r><a:rPr lang="pt-BR"/><a:t>${escape(line)}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

export async function buildStudioPptx(project: StudioProject, template: ArrayBuffer): Promise<Blob> {
  const line = project.line || "Konectar.me";
  if (!styles[line]) throw new Error("Linha de apresentação não reconhecida.");
  const zip = await JSZip.loadAsync(template);
  const read = async (path: string) => {
    const file = zip.file(path);
    if (!file) throw new Error("O modelo de apresentação está incompleto.");
    return file.async("string");
  };
  const source: StudioSlide[] = project.kind === "roteiro"
    ? project.scenes.map(scene => ({ id: scene.id, title: scene.title, content: scene.visual, notes: scene.speech, type: "conteudo" }))
    : orderedStudioSlides(project.slides);
  if (!source.length) throw new Error("Adicione conteúdo antes de exportar a apresentação.");
  const slides = [...source];
  if (slides[0]?.type !== "capa") slides.unshift({ id: "cover", title: project.title, content: "", notes: "", type: "capa" });
  if (slides.at(-1)?.type !== "encerramento") slides.push({ id: "end", title: "Encerramento", content: "", notes: "", type: "encerramento" });
  const end = line === "Konectar.me" ? 11 : line === "Konecta Kids" ? 4 : 3;
  const templateNumbers = [...new Set([1, 2, line === "Konecta Kids" ? 3 : 2, end, ...(line === "Konecta Kids" ? [5] : [])])];
  const originals = new Map<number, { xml: string; rels: string }>();
  for (const number of templateNumbers) originals.set(number, { xml: await read(`ppt/slides/slide${number}.xml`), rels: await read(`ppt/slides/_rels/slide${number}.xml.rels`) });
  const presentation = parse(await read("ppt/presentation.xml"));
  const relationships = parse(await read("ppt/_rels/presentation.xml.rels"));
  const contentTypes = parse(await read("[Content_Types].xml"));
  const list = all(presentation, P, "sldIdLst")[0];
  while (list.firstChild) list.removeChild(list.firstChild);
  all(relationships, REL, "Relationship").filter(node => node.getAttribute("Type") === `${R}/slide`).forEach(node => node.parentNode?.removeChild(node));
  all(contentTypes, "http://schemas.openxmlformats.org/package/2006/content-types", "Override").filter(node => /^\/ppt\/(slides|notesSlides)\//.test(node.getAttribute("PartName") || "")).forEach(node => node.parentNode?.removeChild(node));
  Object.keys(zip.files).filter(path => /^ppt\/(slides|notesSlides)\//.test(path)).forEach(path => zip.remove(path));
  const addRel = (doc: Document, id: string, type: string, target: string) => {
    const node = doc.createElementNS(REL, "Relationship");
    node.setAttribute("Id", id); node.setAttribute("Type", `${R}/${type}`); node.setAttribute("Target", target);
    doc.documentElement.appendChild(node);
  };
  const addType = (path: string, type: string) => {
    const node = contentTypes.createElementNS(contentTypes.documentElement.namespaceURI, "Override");
    node.setAttribute("PartName", path); node.setAttribute("ContentType", `application/vnd.openxmlformats-officedocument.presentationml.${type}+xml`);
    contentTypes.documentElement.appendChild(node);
  };
  for (const [index, slide] of slides.entries()) {
    const number = index + 1;
    const base = originals.get(slide.type === "capa" ? 1 : slide.type === "encerramento" ? end : line === "Konecta Kids" && ["gancho", "resumo", "exercicio"].includes(slide.type || "") ? 5 : line === "Konecta Kids" && slide.type !== "objetivo_bncc" ? 3 : 2)!;
    const rels = parse(base.rels);
    let picture: { relationship: string; ratio: number } | undefined;
    if (slide.image?.url) {
      try {
        const image = await resolveImageAsBlob(slide.image.url);
        if (image) {
          const mime = image.type.split(";")[0] || "image/jpeg";
          if (["image/png", "image/jpeg", "image/webp"].includes(mime)) {
            let ratio = 1;
            if (typeof createImageBitmap === "function") {
              try {
                const bitmap = await createImageBitmap(image);
                ratio = bitmap.width / bitmap.height;
                bitmap.close();
              } catch {
                /* ignore bitmap dimension error */
              }
            }
            const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "jpg";
            const filename = `studio-image-${number}.${extension}`;
            zip.file(`ppt/media/${filename}`, await image.arrayBuffer());
            if (!all(contentTypes, "http://schemas.openxmlformats.org/package/2006/content-types", "Default").some(item => item.getAttribute("Extension") === extension)) {
              const item = contentTypes.createElementNS(contentTypes.documentElement.namespaceURI, "Default");
              item.setAttribute("Extension", extension);
              item.setAttribute("ContentType", mime);
              contentTypes.documentElement.appendChild(item);
            }
            addRel(rels, "rIdStudioImage", "image", `../media/${filename}`);
            picture = { relationship: "rIdStudioImage", ratio };
          }
        }
      } catch (err) {
        console.warn(`Aviso: falha ao carregar imagem para slide ${number} do PowerPoint:`, err);
      }
    }
    zip.file(`ppt/slides/slide${number}.xml`, fillSlide(base.xml, slide, project, picture));
    all(rels, REL, "Relationship").filter(node => /\/(notesSlide|tags|comments)$/.test(node.getAttribute("Type") || "")).forEach(node => node.parentNode?.removeChild(node));
    addRel(rels, "rIdStudioNotes", "notesSlide", `../notesSlides/notesSlide${number}.xml`);
    zip.file(`ppt/slides/_rels/slide${number}.xml.rels`, serialize(rels));
    const notes = [slide.notes, ...(slide.sourcePages ? [`Fonte do conteúdo: apostila, página(s) ${slide.sourcePages}`] : []), ...(slide.image?.url ? [`Imagem: ${slide.image.description}`, slide.image.caption, slide.image.source || "Fonte não informada", slide.image.page ? `Página da imagem: ${slide.image.page}` : "", slide.image.status || ""] : []), ...(slide.pending || [])].filter(Boolean).join("\n");
    zip.file(`ppt/notesSlides/notesSlide${number}.xml`, notesXml(notes));
    const notesRels = parse(`<Relationships xmlns="${REL}"/>`);
    addRel(notesRels, "rId1", "slide", `../slides/slide${number}.xml`);
    if (zip.file("ppt/notesMasters/notesMaster1.xml")) addRel(notesRels, "rId2", "notesMaster", "../notesMasters/notesMaster1.xml");
    zip.file(`ppt/notesSlides/_rels/notesSlide${number}.xml.rels`, serialize(notesRels));
    const id = presentation.createElementNS(P, "p:sldId");
    id.setAttribute("id", String(255 + number)); id.setAttributeNS(R, "r:id", `rIdStudio${number}`); list.appendChild(id);
    addRel(relationships, `rIdStudio${number}`, "slide", `slides/slide${number}.xml`);
    addType(`/ppt/slides/slide${number}.xml`, "slide");
    addType(`/ppt/notesSlides/notesSlide${number}.xml`, "notesSlide");
  }
  // Template-specific custom shows can reference slides that are no longer present.
  all(presentation, P, "custShowLst").forEach(node => node.parentNode?.removeChild(node));
  zip.file("ppt/presentation.xml", serialize(presentation));
  zip.file("ppt/_rels/presentation.xml.rels", serialize(relationships));
  zip.file("[Content_Types].xml", serialize(contentTypes));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
}

export async function exportStudioPptx(project: StudioProject): Promise<void> {
  const templates: Record<string, string> = { "Konecta Kids": "konecta-kids", "Konectar.me": "konectar-me", "Educação Corporativa": "educacao-corporativa" };
  const file = templates[project.line || "Konectar.me"];
  if (!file) throw new Error("Selecione uma linha INNYX válida.");
  const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${basePath}/templates/${file}.pptx`);
    if (!response.ok) response = await fetch(`templates/${file}.pptx`);
  } catch {
    response = await fetch(`templates/${file}.pptx`);
  }
  if (!response.ok) throw new Error("Não foi possível carregar o modelo de apresentação INNYX. Tente novamente.");
  const blob = await buildStudioPptx(project, await response.arrayBuffer());
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${cleanText(studioFilename(project)).replace(/[\t\n\r]/g, "-")}.pptx`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
