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
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 키 처리 · 업로드는 에디터 생성 시점에 묶이므로 최신 값은 ref 로
  const live = useRef({ slash, active, items: [] as SlashItem[], props });
  const editorRef = useRef<Editor | null>(null);

  const insertImages = async (files: File[], at?: number) => {
    const e = editorRef.current;
    if (!e) return;
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const src = await live.current.props.onUploadImage(file);
        const pos = at ?? e.state.selection.to;
        e.chain().focus().insertContentAt(pos, { type: "image", attrs: { src, alt: file.name } }).run();
      } catch (err) {
        live.current.props.onError((err as Error).message || "이미지를 올리지 못했어요");
      } finally {
        setUploading((n) => n - 1);
      }
    }
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
      handleDrop: (view, ev) => {
        const files = [...(ev.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length || !live.current.props.editable) return false;
        const pos = view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos;
        void insertImages(files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      // 읽기 전용에서 토글을 펼치고 접어도 문서(open 속성)가 바뀌므로 저장하지 않음
      if (e.isEditable && live.current.props.editable) live.current.props.onChange(JSON.stringify(e.getJSON()));
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

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div ref={wrapRef} className="relative">
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

      {uploading > 0 && (
        <p className="mt-2 text-xs text-brand-300" role="status">
          이미지 올리는 중… ({uploading})
        </p>
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
