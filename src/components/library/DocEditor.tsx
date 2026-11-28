"use client";

/**
 * 노션식 블록 에디터 (Tiptap)
 * - '/' 를 치면 블록 메뉴: 제목 · 목록 · 토글 · 인용 · 코드 · 구분선 · 이미지
 * - 글자를 고르면 굵게 · 기울임 · 취소선 · 코드 · 링크 메뉴
 * - 이미지는 붙여넣기 · 끌어다 놓기 · /이미지 로 올림 (Storage)
 * - 읽기 전용(editable=false)이면 그대로 문서 보기 — 토글은 읽을 때도 펼치고 접을 수 있음
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Placeholder } from "@tiptap/extensions";
import { Fragment, Slice } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";

type Range = { from: number; to: number };

interface SlashItem {
  key: string;
  icon: string;
  label: string;
  hint: string;
  /** 검색어 (한글 · 영어) */
  terms: string;
  run: (e: Editor, r: Range, pickImage: () => void) => void;
}

const chainAt = (e: Editor, r: Range) => e.chain().focus().deleteRange(r);

const SLASH_ITEMS: SlashItem[] = [
  { key: "p", icon: "¶", label: "텍스트", hint: "일반 글", terms: "텍스트 글 text paragraph", run: (e, r) => chainAt(e, r).setParagraph().run() },
  { key: "h1", icon: "H1", label: "제목 1", hint: "큰 제목", terms: "제목1 heading1 h1", run: (e, r) => chainAt(e, r).setHeading({ level: 1 }).run() },
  { key: "h2", icon: "H2", label: "제목 2", hint: "중간 제목", terms: "제목2 heading2 h2", run: (e, r) => chainAt(e, r).setHeading({ level: 2 }).run() },
  { key: "h3", icon: "H3", label: "제목 3", hint: "작은 제목", terms: "제목3 heading3 h3", run: (e, r) => chainAt(e, r).setHeading({ level: 3 }).run() },
  { key: "ul", icon: "•", label: "글머리 목록", hint: "점 목록", terms: "글머리 목록 bullet list ul", run: (e, r) => chainAt(e, r).toggleBulletList().run() },
  { key: "ol", icon: "1.", label: "번호 목록", hint: "1. 2. 3.", terms: "번호 목록 numbered ordered list ol", run: (e, r) => chainAt(e, r).toggleOrderedList().run() },
  { key: "toggle", icon: "▸", label: "토글", hint: "펼치고 접는 목록", terms: "토글 접기 toggle details", run: (e, r) => chainAt(e, r).setDetails().updateAttributes("details", { open: true }).run() },
  { key: "quote", icon: "❝", label: "인용", hint: "인용 · 강조 상자", terms: "인용 quote blockquote", run: (e, r) => chainAt(e, r).toggleBlockquote().run() },
  { key: "code", icon: "</>", label: "코드", hint: "명령어 · 코드 블록", terms: "코드 code 명령어", run: (e, r) => chainAt(e, r).toggleCodeBlock().run() },
  { key: "hr", icon: "—", label: "구분선", hint: "가로줄", terms: "구분선 divider hr line", run: (e, r) => chainAt(e, r).setHorizontalRule().run() },
  {
    key: "img",
    icon: "🖼",
    label: "이미지",
    hint: "파일 올리기 (10MB 미만)",
    terms: "이미지 사진 그림 image picture",
    run: (e, r, pickImage) => {
      chainAt(e, r).run();
      pickImage();
    },
  },
];

interface SlashState {
  range: Range;
  query: string;
  left: number;
  top: number;
}

/** 커서 바로 앞이 '/검색어' 인지 */
function findSlash(e: Editor): Omit<SlashState, "left" | "top"> | null {
  const { selection } = e.state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock || $from.parent.type.name === "codeBlock") return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
  const m = /(?:^|\s)\/([^\s/]{0,20})$/.exec(before);
  if (!m) return null;
  return { range: { from: $from.pos - m[1].length - 1, to: $from.pos }, query: m[1].toLowerCase() };
}

/** 올리는 중인 이미지는 임시 주소(blob:)로 먼저 보여 줌 — 저장할 때는 빼고, 다 올라가면 진짜 주소로 바꿈 */
const isPending = (src: unknown) => typeof src === "string" && src.startsWith("blob:");

function stripPending(node: Record<string, unknown>): Record<string, unknown> | null {
  if (node.type === "image" && isPending((node.attrs as { src?: unknown } | undefined)?.src)) return null;
  const content = node.content as Record<string, unknown>[] | undefined;
  return content ? { ...node, content: content.map(stripPending).filter((n): n is Record<string, unknown> => !!n) } : node;
}

/** 드래그에 파일이 들어 있는지 (글 · 링크 드래그와 구분) */
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

/** 웹페이지에서 끌어온 이미지 주소 (파일이 아닌 경우) */
function droppedImageUrl(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  const html = dt.getData("text/html");
  const m = html && /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (m && /^https?:/.test(m[1])) return m[1];
  const uri = dt.getData("text/uri-list").split("\n")[0]?.trim();
  return uri && /^https?:.*\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(uri) ? uri : null;
}

export function DocEditor(props: {
  /** 에디터 JSON 문자열 */
  initial: string;
  /** 바뀌면 바깥에서 보낸 새 본문으로 갈아끼움 (다른 사람이 고친 경우) */
  version: number;
  editable: boolean;
  onChange: (json: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  onError: (msg: string) => void;
}) {
  const { editable } = props;
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [active, setActive] = useState(0);
  const [uploading, setUploading] = useState(0);
  /** 파일을 끌고 페이지 위에 있는 중 */
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 키 처리 · 업로드는 에디터 생성 시점에 묶이므로 최신 값은 ref 로
  const live = useRef({ slash, active, items: [] as SlashItem[], props });
  const editorRef = useRef<Editor | null>(null);

  /**
   * 이미지 넣기: 놓은 자리(없으면 커서, 커서도 없으면 문서 끝)에 바로 흐리게 보여 주고 → 올라가면 진짜 주소로 바꿈.
   * 문장 가운데에 놓아도 문단을 쪼개지 않게 가장 가까운 블록 사이에 넣음.
   */
  const insertImages = async (all: File[], at?: number) => {
    const e = editorRef.current;
    if (!e) return;
    const { onError, onUploadImage } = live.current.props;
    const files = all.filter((f) => f.type.startsWith("image/"));
    if (files.length < all.length) onError("이미지 파일만 올릴 수 있어요");
    if (!files.length) return;

    const { state } = e;
    const imageType = state.schema.nodes.image;
    const pending = files.map((file) => ({ file, tmp: URL.createObjectURL(file) }));
    const slice = new Slice(Fragment.fromArray(pending.map((p) => imageType.create({ src: p.tmp, alt: p.file.name }))), 0, 0);
    const base = at ?? state.selection.to;
    const pos = dropPoint(state.doc, Math.min(base, state.doc.content.size), slice) ?? base;
    e.view.dispatch(state.tr.replaceRange(pos, pos, slice).scrollIntoView());

    /** 임시 주소인 이미지를 찾아 바꾸거나(src) 지움(null) */
    const settle = (tmp: string, src: string | null) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      let tr = ed.state.tr;
      const hits: number[] = [];
      ed.state.doc.descendants((n, p) => {
        if (n.type.name === "image" && n.attrs.src === tmp) hits.push(p);
      });
      for (const p of hits.reverse()) {
        tr = src ? tr.setNodeMarkup(p, undefined, { ...ed.state.doc.nodeAt(p)!.attrs, src }) : tr.delete(p, p + 1);
      }
      if (hits.length) ed.view.dispatch(tr);
      URL.revokeObjectURL(tmp);
    };

    setUploading((n) => n + pending.length);
    await Promise.all(
      pending.map(async ({ file, tmp }) => {
        try {
          settle(tmp, await onUploadImage(file));
        } catch (err) {
          settle(tmp, null);
          onError(`${file.name}: ${(err as Error).message || "이미지를 올리지 못했어요"}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  /** 웹페이지 이미지: 받아서 우리 저장소에 다시 올림 (원본 링크는 사라질 수 있음 — 노션 이미지 주소 등) */
  const insertFromUrl = async (url: string, at?: number) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      if (!r.ok || !blob.type.startsWith("image/")) throw new Error();
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
      await insertImages([new File([blob], name, { type: blob.type })], at);
    } catch {
      live.current.props.onError("이 웹 이미지는 바로 가져올 수 없어요. 컴퓨터에 저장한 뒤 파일을 끌어다 놓아 주세요");
    }
  };

  /** 에디터 안에 놓았을 때 (같은 문서 안에서 블록을 옮기는 드래그는 에디터가 처리) */
  const onEditorDrop = (view: EditorView, ev: DragEvent) => {
    setDragging(false);
    if (!live.current.props.editable || (view as unknown as { dragging: unknown }).dragging) return false;
    const pos = view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos;
    const files = [...(ev.dataTransfer?.files ?? [])];
    if (files.length) {
      void insertImages(files, pos);
      return true;
    }
    const url = droppedImageUrl(ev.dataTransfer);
    if (url) {
      void insertFromUrl(url, pos);
      return true;
    }
    return false;
  };

  const filtered = slash ? SLASH_ITEMS.filter((it) => !slash.query || it.terms.toLowerCase().includes(slash.query) || it.label.includes(slash.query)) : [];
  // 에디터 콜백(키 · 붙여넣기)이 최신 값을 보도록 그릴 때마다 갱신
  useLayoutEffect(() => {
    live.current = { slash, active, items: filtered, props };
  });

  const runItem = (it: SlashItem) => {
    const e = editorRef.current;
    if (!e || !live.current.slash) return;
    it.run(e, live.current.slash.range, () => fileRef.current?.click());
    setSlash(null);
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: safeParse(props.initial),
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: { color: "#57b8e0", width: 3 }, // 놓을 자리 표시 줄
        link: { openOnClick: !editable, autolink: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
      }),
      Image.configure({ HTMLAttributes: { class: "doc-image" } }),
      Details.configure({ persist: true, HTMLAttributes: { class: "doc-toggle" } }),
      DetailsSummary,
      DetailsContent,
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "제목";
          if (node.type.name === "detailsSummary") return "토글 제목";
          return "글을 쓰거나 '/' 를 눌러 블록을 넣어 보세요";
        },
      }),
    ],
    editorProps: {
      attributes: { class: "doc-prose focus:outline-none" },
      handleKeyDown: (_view, ev) => {
        const { slash: s, items: list, active: a } = live.current;
        if (!s || !list.length) return false;
        if (ev.key === "ArrowDown") {
          setActive((a + 1) % list.length);
          return true;
        }
        if (ev.key === "ArrowUp") {
          setActive((a - 1 + list.length) % list.length);
          return true;
        }
        if (ev.key === "Enter" || ev.key === "Tab") {
          runItem(list[a]);
          return true;
        }
        if (ev.key === "Escape") {
          setSlash(null);
          return true;
        }
        return false;
      },
      handlePaste: (_view, ev) => {
        const files = [...(ev.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length || !live.current.props.editable) return false;
        void insertImages(files);
        return true;
      },
      handleDrop: (view, ev) => onEditorDrop(view, ev),
    },
    onUpdate: ({ editor: e }) => {
      // 읽기 전용에서 토글을 펼치고 접어도 문서(open 속성)가 바뀌므로 저장하지 않음
      // 올리는 중인 이미지(임시 주소)는 빼고 저장 — 다 올라가면 진짜 주소로 바뀌며 다시 저장됨
      if (e.isEditable && live.current.props.editable) live.current.props.onChange(JSON.stringify(stripPending(e.getJSON())));
    },
    onTransaction: ({ editor: e }) => {
      if (!e.isEditable) return;
      const found = findSlash(e);
      if (!found) return setSlash(null);
      const c = e.view.coordsAtPos(found.range.from);
      const box = wrapRef.current?.getBoundingClientRect();
      const next = { ...found, left: Math.round(c.left - (box?.left ?? 0)), top: Math.round(c.bottom - (box?.top ?? 0) + 6) };
      const prev = live.current.slash;
      // 같은 값이면 다시 그리지 않음 (그리면 에디터 옵션 갱신 → 또 트랜잭션 → 무한 반복)
      if (prev && prev.query === next.query && prev.left === next.left && prev.top === next.top && prev.range.from === next.range.from && prev.range.to === next.range.to)
        return;
      if (prev?.query !== next.query) setActive(0);
      setSlash(next);
    },
    onBlur: () => setTimeout(() => setSlash(null), 150),
  });
  useLayoutEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // 다른 사람이 고친 본문 반영
  useEffect(() => {
    if (!editor || props.version === 0) return;
    editor.commands.setContent(safeParse(props.initial), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, props.version]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  /**
   * 페이지 어디에 놓아도 브라우저가 이미지 파일을 열어 자료실을 떠나지 않게 막음.
   * 고칠 수 있으면: 에디터 밖(제목 · 여백 · 블록 사이)에 놓아도 커서 자리(없으면 문서 끝)에 넣음.
   */
  useEffect(() => {
    let depth = 0;
    const inEditor = (t: EventTarget | null) => t instanceof Node && !!editorRef.current?.view.dom.contains(t);
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = live.current.props.editable ? "copy" : "none";
    };
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      if (live.current.props.editable) setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (inEditor(e.target) || !live.current.props.editable) return; // 에디터 안은 handleDrop 이 처리
      const ed = editorRef.current;
      if (!ed) return;
      const sel = ed.state.selection;
      // 한 번도 누르지 않았으면 선택이 문서 맨 앞 → 이때는 문서 끝에
      void insertImages([...(e.dataTransfer?.files ?? [])], sel.from <= 1 && !ed.isFocused ? ed.state.doc.content.size : sel.to);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div ref={wrapRef} className={`relative rounded-xl transition ${dragging ? "outline-2 outline-offset-8 outline-dashed outline-brand-400/70" : ""}`}>
      {editor && editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image") && !e.isActive("codeBlock")}
          className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-ink-800 p-1 shadow-xl"
        >
          {(
            [
              ["B", "굵게", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "font-bold"],
              ["I", "기울임", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "italic"],
              ["S", "취소선", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "line-through"],
              ["</>", "코드", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"), "font-mono text-xs"],
              ["🔗", "링크", setLink, editor.isActive("link"), ""],
            ] as const
          ).map(([label, title, fn, on, cls]) => (
            <button
              key={title}
              type="button"
              title={title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={fn}
              className={`min-w-8 rounded px-2 py-1 text-sm ${cls} ${on ? "bg-brand-500 text-white" : "text-ink-100 hover:bg-white/10"}`}
            >
              {label}
            </button>
          ))}
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />

      {slash && filtered.length > 0 && (
        <div
          role="listbox"
          aria-label="블록 넣기"
          className="absolute z-30 max-h-80 w-64 overflow-y-auto rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl"
          style={{ left: slash.left, top: slash.top }}
        >
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-bold text-ink-400">블록 넣기</p>
          {filtered.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => runItem(it)}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${i === active ? "bg-white/10" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-night text-xs font-bold text-ink-200">
                {it.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{it.label}</span>
                <span className="block text-xs text-ink-400">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <p className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-brand">
            🖼 원하는 자리에 놓으세요 — 본문 밖에 놓으면 커서 자리(없으면 맨 끝)에 들어가요
          </p>
        </div>
      )}
      {uploading > 0 && !dragging && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <p className="rounded-full bg-ink-800 px-4 py-2 text-sm text-white shadow-xl" role="status">
            이미지 올리는 중… {uploading}개
          </p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void insertImages(files);
        }}
      />
    </div>
  );
}

function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}
