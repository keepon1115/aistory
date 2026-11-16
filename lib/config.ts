// 調整したい値はここに集める。

/** 保存画像の隅に入れる文字列（ここ1か所で変更できる） */
export const EVENT_LABEL = "2026/11スクールフェスタ";

export const WORD_MIN = 2;
export const WORD_MAX = 10;
/** 物語本文の上限。これを超えたら1回だけ生成し直す */
export const STORY_MAX = 250;

/** 1人あたりの投影時間の概算（秒）。スマホの待ち時間表示に使う */
export const SECONDS_PER_PERSON = 45;
/** 順番待ちがこれを超えたら新規送信を断る */
export const MAX_QUEUE = 30;
/** 同じ端末の再送信禁止時間（秒）。キオスクは対象外 */
export const COOLDOWN_SECONDS = 60;
/** キオスクでQRを出してから入力画面に戻るまで（秒） */
export const KIOSK_RETURN_SECONDS = 20;

/** 原稿用紙のマス数 */
export const SCREEN_GRID = { rows: 12, cols: 24 };
export const IMAGE_GRID = { rows: 20, cols: 14 };

/** 投影の演出（ミリ秒）。混雑していても変えない */
export const TIMING = {
  userCharMs: 150,
  silenceMs: 5000,
  aiCharMs: 80,
  holdMs: 15000,
  fadeMs: 2000,
  pollMs: 2000,
};

export const COLORS = {
  background: "#000000",
  user: "#ffffff",
  ai: "#9a9a9a",
  line: "rgba(255,255,255,0.16)",
};

export const STORAGE_KEY_STORY = "genko:storyId";
export const STORAGE_KEY_LAST_SUBMIT = "genko:lastSubmitAt";
