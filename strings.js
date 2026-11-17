/* UI strings and the tiny translation layer.
 *
 * English is the source language and lives where it always did: in index.html
 * and in the JS. Nothing here changes the English page. A translation is a
 * dictionary keyed by the ENGLISH text, so a missing key simply shows the
 * English (a half-translated screen is better than a blank one).
 *
 *   T('YOU FLED SAFELY.')                       -> text for the page language
 *   T('{name} WAS CAUGHT!', { name: 'Tomotot' })
 *
 * The page language is <html lang>. / is English; build.js generates /ja/
 * from index.html with lang="ja", the Japanese prose from ja-prose.html, and
 * the head tags (title, description, canonical, hreflang).
 *
 * translateDom() runs once, here, before any other script, and rewrites the
 * static markup: every text node, plus aria-label / title / placeholder / alt,
 * whose normalised text is a key. Elements with data-i18n="key" are replaced
 * wholesale (used where a bare "." or other generic text could not be a key).
 *
 * Not translated on purpose (see agent_docs/asia-plan.md):
 *   - mon names, which are a brand and double as search terms
 *   - the share-card image (canvas text needs the CJK font loaded first)
 *   - /research/, /pomodex/, /privacy/, /terms/, which stay English
 * This file's Japanese is a first pass that needs a native speaker's review
 * before any marketing push.
 *
 * Whenever a Japanese string below changes, run:
 *   node tools/subset-ja-font.js
 * It rebuilds assets/fonts/DotGothic16-ja.woff2 for exactly the characters
 * used, and build.js fails if the committed font is out of date.
 */

const LANG = ((document.documentElement.lang || 'en').toLowerCase().split('-')[0]);

const I18N = {
  ja: {
    // ── Timer screen ──
    'Settings': '設定',
    'How catching works': 'つかまえ方',
    'LV 1': 'Lv.1',
    'View companion details': '相棒の詳細を見る',
    'Your Pomomon companion': 'あなたの相棒ポモモン',
    'Increase focus time by 1 minute': '集中時間を1分ふやす',
    'Decrease focus time by 1 minute': '集中時間を1分へらす',
    'FOCUS': '集中',
    'FOCUS SESSION': '集中タイム',
    'NONE': 'なし',
    'OK': 'OK',
    'BUILDING…': '作成中…',
    'SHORT BREAK': '短い休憩',
    'LONG BREAK': '長い休憩',
    'RESET': 'リセット',
    'START': 'スタート',
    'PAUSE': 'ストップ',
    'TODAY': '今日',
    'ALL TIME': '通算',
    'MINUTES': '分',
    'CATCHES': '捕獲数',
    'Read more about PomoMons': 'ポモモンズについてもっと見る',
    'Showing today\'s stats — switch to all time': '今日の記録を表示中。タップで通算に切り替え',
    'Showing all-time stats — switch to today': '通算の記録を表示中。タップで今日に切り替え',
    'Showing today — tap for all time': '今日の記録。タップで通算',
    'Showing all time — tap for today': '通算の記録。タップで今日',
    'COMPLETE A {n}-MINUTE FOCUS SESSION AND A WILD POMOMON APPEARS.':
      '{n}分の集中セッションを終えると、ポモモンがあらわれます。',
    'LEVEL UP! LV {n}': 'レベルアップ! Lv.{n}',
    'LV {n}': 'Lv.{n}',

    // ── Collection ──
    'BACK': 'もどる',
    'MY MONS': 'あつめたモン',
    'POMODEX': 'ポモデックス',
    'Sort by': 'ならびかえ',
    'Sort your mons': 'モンをならびかえ',
    'NEWEST': '新しい順',
    'SPECIES': '種類',
    'LEVEL': 'レベル',
    'RARITY': 'レア度',
    'Drag a mon here to blend into a smoothie': 'モンをここにドラッグしてスムージーにする',
    'BLEND': 'ブレンド',
    'DRAG A MON HERE FOR A SMOOTHIE': 'モンをここへドラッグ',
    'SMOOTHIES': 'スムージー',
    'DRAG TO A MON FOR +1 LEVEL': 'モンへドラッグで+1Lv',
    'PICK A MON · TAP TO CANCEL': 'モンをえらぶ・取消',
    'TAP, THEN PICK A MON': 'タップで選ぶ',
    'COMPLETE A FOCUS SESSION TO CATCH YOUR FIRST POMOMON!': '集中セッションを終えて、最初のポモモンをつかまえよう!',
    'DON\'T LOSE YOUR MONS!': 'モンを失わないで!',
    'MAX LEVEL': '最大レベル',
    'UNKNOWN': '不明',
    'MALE': 'オス',
    'FEMALE': 'メス',
    'UNEQUIP': '相棒をはずす',
    'SET AS COMPANION': '相棒にする',
    'FINAL FORM': '最終形態',
    'BASE': 'ベース',

    // ── Encounter ──
    'CATCH!': 'つかまえる!',
    'RUN AWAY': 'にげる',
    'NEXT': 'つぎへ',
    'INFO': 'じょうほう',
    'SHARE': 'シェア',
    'A WILD MON APPEARED!': 'モンがあらわれた!',
    'YOU FLED SAFELY.': 'うまくにげきれた!',
    'Wild Pomomon': 'あらわれたポモモン',
    'CONGRATULATIONS!': 'おめでとう!',
    '{name} WAS CAUGHT!': '{name}をつかまえた!',
    ' ✨ SHINY!': ' ✨ シャイニー!',
    '{name} COULDN\'T BE SAVED. PRIVATE BROWSING CAN BLOCK SAVING.':
      '{name}を保存できませんでした。プライベートブラウズでは保存がブロックされることがあります。',
    '⚠ BLEND THIS MON?': '⚠ このモンをブレンドする?',
    'ARE YOU SURE YOU WANT TO BLEND': 'このモンを',
    'INTO A SMOOTHIE ITEM?': 'スムージーにブレンドしますか?',
    'THIS CANNOT BE UNDONE!': '元にもどせません!',
    'BLEND IT!': 'ブレンドする!',
    'CANCEL': 'キャンセル',
    'CATCH RARITY': '出現率',
    'SAVORY': 'うま味',
    'SWEET': 'あまい',
    'SPICY': 'からい',
    'SOUR': 'すっぱい',
    'BITTER': 'にがい',
    'NORMAL': 'ノーマル',
    'DARK': 'ダーク',
    'SHINY': 'シャイニー',
    'RARE DONOT': 'レア DONOT',
    'GOT IT!': 'OK!',
    'GOT IT': 'OK',
    '🖤 DARK!': '🖤 ダーク!',
    '✨ SHINY!': '✨ シャイニー!',
    'YOUR CATCH CARD': 'キャッチカード',
    'EVOLUTION PATH': '進化ルート',
    'Copied! Paste it in Discord or anywhere.': 'コピーしました! Discordなどにはりつけてね。',
    'Couldn\'t copy — try again?': 'コピーできませんでした。もう一度どうぞ。',
    'Saved to your downloads.': 'ダウンロードに保存しました。',
    'CONTINUE FOCUSING': '集中をつづける',
    'START BREAK': '休憩をはじめる',
    'START LONG BREAK': '長い休憩をはじめる',

    // ── Mon detail ──
    'Caught Pomomon': 'つかまえたポモモン',
    'Nickname': 'ニックネーム',
    'Nickname this mon': 'このモンにニックネームをつける',
    'NICKNAME': 'ニックネーム',
    'SAVE': '保存',
    'NEXT LEVEL': '次のレベル',
    'TYPE': 'タイプ',
    'GENDER': '性別',
    'NATURE': '性格',
    'HELD ITEM': 'アイテム',
    'CAUGHT': '捕獲',
    'GOTCHA!': 'ゲット!',
    'WAS ADDED TO YOUR COLLECTION!': 'コレクションに追加されました!',
    'CONTINUE!': 'つづける!',
    'Evolving Pomomon': '進化中のポモモン',
    'AWESOME!': 'やったね!',
    'STOP EVOLUTION': '進化をやめる',
    'WHAT? {name} IS EVOLVING!': '{name}が進化しはじめた!',
    '{from} EVOLVED INTO {to}!': '{from}が{to}に進化!',
    '{name} STOPPED EVOLVING!': '{name}の進化がとまった!',
    'IT STAYS A {name}.': '{name}のままです。',

    // ── Save code / backup ──
    'YOUR SAVE CODE': 'セーブコード',
    'GET A CODE THAT BRINGS YOUR MONS BACK ANYWHERE.': 'どこでもモンを復元できるコードを発行します。',
    'ADD YOUR EMAIL TO ALSO GET IT BY MAIL.': 'メールアドレスを入れると、コードをメールでも受け取れます。',
    'YOUR MONS LIVE IN THIS BROWSER ONLY.': 'モンはこのブラウザにだけ保存されています。',
    'KEEP THIS CODE TO BRING THEM BACK ANYWHERE.': 'このコードがあれば、どこでも復元できます。',
    'Email address (optional)': 'メールアドレス(任意)',
    'EMAIL (OPTIONAL)': 'メール(任意)',
    'SUBMIT': '送信',
    'SENDING': '送信中',
    'Your save code': 'セーブコード',
    'COPY': 'コピー',
    'RESTORE A COLLECTION': 'コレクションを復元',
    'Paste a save code to restore': '復元するセーブコードをはりつけ',
    'PASTE A CODE HERE': 'ここにコードをはりつけ',
    'THIS REPLACES WHAT YOU HAVE NOW!': '今のデータはうわがきされます!',
    'RESTORE': '復元',
    'CLOSE': 'とじる',
    'Couldn\'t build a code.': 'コードを作れませんでした。',
    'That address looks off — fix it, or leave it blank.': 'メールアドレスが正しくないようです。直すか、空欄のままにしてください。',
    'Couldn\'t build a code — try again in a moment.': 'コードを作れませんでした。少し待ってからもう一度どうぞ。',
    'Code ready below — also emailed to you.': '下にコードが出ました。メールにも送りました。',
    'Code ready below. Couldn\'t email it — copy it instead.': '下にコードが出ました。メールは送れなかったので、コピーしてください。',
    'Code ready below — copy it.': '下にコードが出ました。コピーしてください。',
    '{mons} mons, level {level}, saved {when}. Press RESTORE again to replace what you have now.':
      'モン{mons}匹、レベル{level}、保存日 {when}。もう一度「復元」を押すと今のデータと入れ替わります。',
    'an unknown date': '不明な日付',
    'Something went wrong writing the save. Nothing was changed.': '保存データの書きこみに失敗しました。何も変更されていません。',
    'Copied.': 'コピーしました。',

    // ── History ──
    'DAY BY DAY': '日ごとの記録',
    'DAY': '日付',
    'SESS': '回数',
    'MINS': '分',
    'Sessions, minutes and catches per day': '1日ごとのセッション数・分数・捕獲数',
    'NOTHING HERE YET.': 'まだ記録がありません。',
    'FINISH A FOCUS SESSION AND THE DAY SHOWS UP.': '集中セッションを終えると、ここに表示されます。',
    'Catch your first Pomomon to see it here!': '最初のポモモンをつかまえると、ここに表示されます!',
    'Collection unavailable (storage not supported).': 'コレクションを使えません(このブラウザは保存に対応していません)。',
    'Could not load collection.': 'コレクションを読み込めませんでした。',
    'Collection unavailable.': 'コレクションを使えません。',
    'Could not load mons.': 'モンを読み込めませんでした。',
    'TOTAL': '合計',
    'YESTERDAY': '昨日',

    // ── Notifications help ──
    'TURN ON NOTIFICATIONS': '通知をオンにする',
    'Your browser hid the request.': 'ブラウザが通知の許可リクエストを隠しました。',
    'Click the icon left of the web address.': 'アドレスバーの左のアイコンをクリック。',
    'Set Notifications to Allow.': '「通知」を「許可」にする。',
    'Reload the page.': 'ページを再読み込みする。',
    'Click the bell in the address bar.': 'アドレスバーのベルをクリック。',
    'Choose Allow.': '「許可」をえらぶ。',
    'Focus session complete': '集中セッション完了',
    'Nice work — time for a break. A wild Pomomon showed up.': 'おつかれさま! 休憩の時間です。ポモモンがあらわれました。',
    'Break over': '休憩おわり',
    'Back to it — start your next focus session.': 'さあ再開! 次の集中セッションをはじめよう。',
    'Break time! — PomoMons': '休憩タイム! — PomoMons',
    'Back to work! — PomoMons': '再開! — PomoMons',
    'Break Time': '休憩タイム',

    // ── Settings menu ──
    'Game sounds on': 'ゲーム音 オン',
    'Game sounds off': 'ゲーム音 オフ',
    'Timer sounds on': 'タイマー音 オン',
    'Timer sounds off': 'タイマー音 オフ',
    'Toggle game sounds': 'ゲーム音の切りかえ',
    'Toggle timer sounds': 'タイマー音の切りかえ',
    'History': '履歴',
    'See your day-by-day history': '日ごとの履歴を見る',
    'Join our Discord': 'Discordに参加',
    'Save': 'セーブ',
    'Save your progress by email': 'メールで進行状況を保存',
    'Notify when timer ends': 'タイマー終了時に通知',

    // ── Signup card ──
    'No thanks': 'いいえ',
    'DON\'T LOSE YOUR MONS': 'モンを失わないで',
    'Your mons live in this browser only. We\'ll email you a code that brings them back.':
      'モンはこのブラウザにだけ保存されます。復元用のコードをメールでお送りします。',
    'Email address': 'メールアドレス',
    'SEND': '送信',
    'Also send me occasional updates and polls on which mon to make next': '次に作るモンの投票やお知らせも、ときどき送ってください',
    'By continuing you agree to our': '続けることで、',
    'signup-legal-end': 'に同意したものとみなされます。',
    'Privacy Policy': 'プライバシーポリシー',
    'That address looks off — check it?': 'メールアドレスが正しくないようです。確認してください。',
    'Couldn\'t build your backup code — try again in a moment.': 'バックアップコードを作れませんでした。少し待ってからもう一度どうぞ。',
    'Sent! Check your email for your code.': '送信しました! メールでコードを確認してください。',
    'SEND A FRESH BACKUP': '最新のバックアップを送る',
    'Your last code only covers the mons you had then. This one covers all of them.':
      '前回のコードはそのときのモンだけが対象です。今回のコードはすべてのモンが対象です。',
    'You\'re on the mailing list': 'メールリストに登録済みです',

    // ── Footer (the pages behind these links are English only) ──
    'All 30 Pomomons': '全30種のポモモン(英語)',
    'The research': '研究データ(英語)',
    'Focus Friend alternative': 'Focus Friendの代わりに(英語)',
    'Privacy': 'プライバシー(英語)',
    'Terms': '利用規約(英語)',
    'Discord': 'Discord',
    'Site': 'サイト',
  },
};

// Dynamic text: T('LV {n}', { n: 5 }). A missing key falls back to the English.
function T(key, vars) {
  const table = LANG !== 'en' && I18N[LANG];
  let s = (table && table[key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

// Static markup. Runs once, immediately, while the scripts are still being
// parsed, so the English never paints.
function translateDom(root) {
  const table = LANG !== 'en' && I18N[LANG];
  if (!table) return;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = table[el.getAttribute('data-i18n')];
    if (v) el.textContent = v;
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentNode && n.parentNode.nodeName;
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const v = table[norm(n.nodeValue)];
    if (v) {
      const lead  = /^\s/.test(n.nodeValue) ? ' ' : '';
      const trail = /\s$/.test(n.nodeValue) ? ' ' : '';
      n.nodeValue = lead + v + trail;
    }
  });

  root.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach((el) => {
    ['aria-label', 'title', 'placeholder', 'alt'].forEach((a) => {
      const cur = el.getAttribute(a);
      if (cur && table[norm(cur)]) el.setAttribute(a, table[norm(cur)]);
    });
  });
}

if (LANG !== 'en' && document.body) translateDom(document.body);
