(() => {
  'use strict';

  const APP_NAME = 'レシピどこだっけ？';
  const KEYS = { recipes: 'cooking-memo-recipes-v1', tags: 'cooking-memo-tags-v1', locations: 'cooking-memo-locations-v1' };
  const DEFAULT_LOCATIONS = ['YouTube', 'Instagram', 'Xのブックマーク', 'ブックマーク', '画像', 'その他'];
  const SEASONS = ['春', '夏', '秋', '冬', '通年'];
  const app = document.querySelector('#app');
  let state = { view: 'home', recipeId: null, search: '', notice: '', season: '通年', todaySeason: '通年', todayRecipeIds: [] };

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  };
  const recipes = () => read(KEYS.recipes);
  const tags = () => read(KEYS.tags);
  const locations = () => localStorage.getItem(KEYS.locations) === null ? [...DEFAULT_LOCATIONS] : read(KEYS.locations);
  const saveRecipes = (items) => localStorage.setItem(KEYS.recipes, JSON.stringify(items));
  const saveTags = (items) => localStorage.setItem(KEYS.tags, JSON.stringify(items));
  const saveLocations = (items) => localStorage.setItem(KEYS.locations, JSON.stringify(items));
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safeLink = (value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const tagPills = (list = []) => list.length ? `<div class="tags">${list.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : '';
  const recipeCard = (recipe) => `<button class="recipe-card" data-action="detail" data-id="${recipe.id}"><h3>${escapeHtml(recipe.name)}</h3><div class="meta">保存場所：${escapeHtml(recipe.location)}</div>${tagPills(recipe.tags)}</button>`;
  const todayRecipeCard = (recipe) => `<button class="recipe-card" data-action="detail" data-id="${recipe.id}"><h3>${escapeHtml(recipe.name)}</h3><div class="meta">保存場所：${escapeHtml(recipe.location)}</div><div class="meta today-season">季節：${escapeHtml(recipe.season || '未設定')}</div>${tagPills(recipe.tags)}</button>`;
  const header = (title, back = true, right = '') => `<header class="topbar">${back ? '<button class="back-button" data-action="home">‹ 戻る</button>' : `<h1>${APP_NAME}</h1>`}<h1${back ? '' : ' class="visually-hidden"'}>${back ? escapeHtml(title) : ''}</h1>${right}</header>`;
  const notice = () => state.error ? `<p class="error-notice">${escapeHtml(state.error)}</p>` : (state.notice ? `<p class="notice">${escapeHtml(state.notice)}</p>` : '');

  function renderHome() {
    const keyword = state.search.trim().toLocaleLowerCase();
    const matching = recipes().filter(recipe => !keyword || [recipe.name, recipe.location, recipe.notes, ...(recipe.tags || [])]
      .some(value => String(value).toLocaleLowerCase().includes(keyword)));
    const sorted = [...matching].sort((a, b) => b.updatedAt - a.updatedAt);
    const displayed = state.search ? sorted : sorted.slice(0, 8);
    app.innerHTML = `<header class="topbar"><h1>${APP_NAME}</h1><button class="icon-button" data-action="manage-tags">タグ管理</button></header>
      ${notice()}<div class="search-wrap"><span>⌕</span><input id="search" type="search" autocomplete="off" placeholder="料理名・タグ・保存場所で検索" value="${escapeHtml(state.search)}" /></div>
      <div class="home-actions"><button class="primary-button" data-action="new-recipe">＋ 料理を登録</button><button class="secondary-button" data-action="all-recipes">登録した料理</button></div>
      <section><div class="section-heading"><h2>${state.search ? '検索結果' : '最近登録した料理'}</h2>${state.search ? `<span class="meta">${displayed.length}件</span>` : ''}</div>
      <div id="results" class="recipe-list">${displayed.length ? displayed.map(recipeCard).join('') : `<div class="empty">${state.search ? '該当する料理が見つかりませんでした。' : 'まだ料理メモがありません。<br>「＋ 料理を登録」から始めましょう。'}</div>`}</div></section>
      <section class="today-card"><div class="section-heading"><h2>今日なに作る？</h2></div><p class="meta">季節を選んで、今日の候補を3品選びます。</p><div class="season-picker">${SEASONS.map(season => `<button class="season-choice ${season === (state.season || '通年') ? 'selected' : ''}" data-action="select-season" data-season="${season}">${season}</button>`).join('')}</div><button class="primary-button" data-action="pick-today">今日なに作る？</button></section>
      <section><div class="section-heading"><h2>データ・設定</h2></div><div class="home-actions"><button class="secondary-button" data-action="manage-locations">保存場所の管理</button><button class="secondary-button" data-action="backup">バックアップ・復元</button></div></section>`;
    const search = document.querySelector('#search');
    const refreshSearchResults = (input) => {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      renderHome();
      const refreshedSearch = document.querySelector('#search');
      refreshedSearch.focus();
      refreshedSearch.setSelectionRange(selectionStart, selectionEnd);
    };
    search.addEventListener('input', (event) => {
      state.search = event.target.value;
      // 日本語IMEなどの変換中は、input要素を再描画しない。
      // 再描画すると変換中の文字列が確定・取消されてしまうため。
      if (event.isComposing) return;
      refreshSearchResults(event.target);
    });
    search.addEventListener('compositionend', (event) => {
      state.search = event.target.value;
      const completedInput = event.target;
      // 多くのブラウザは直後に isComposing: false の input を発火する。
      // それを優先し、発火しない環境だけ次フレームで検索結果を更新する。
      requestAnimationFrame(() => {
        if (document.querySelector('#search') === completedInput) refreshSearchResults(completedInput);
      });
    });
  }

  function renderForm(editing = null) {
    const recipe = editing || { name: '', location: locations()[0] || '', link: '', notes: '', tags: [], season: '通年' };
    const selected = new Set(recipe.tags || []);
    const locationOptions = [...locations()];
    const selectedSeason = SEASONS.includes(recipe.season) ? recipe.season : '';
    if (recipe.location && !locationOptions.includes(recipe.location)) locationOptions.push(recipe.location);
    app.innerHTML = `${header(editing ? '料理を編集' : '料理を登録')}${notice()}<form id="recipe-form" class="form">
      <div class="field"><label for="name">料理名 <span class="required">必須</span></label><input id="name" name="name" required maxlength="100" value="${escapeHtml(recipe.name)}" placeholder="例：鶏肉とキャベツの炒め物" /></div>
      <div class="field"><label for="location">保存場所 <span class="required">必須</span></label><select id="location" name="location" required>${locationOptions.length ? locationOptions.map(x => `<option ${x === recipe.location ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('') : '<option value="" selected disabled>保存場所を追加してください</option>'}</select><span class="meta">候補は「保存場所の管理」から変更できます。</span></div>
      <div class="field"><label for="season">季節</label><select id="season" name="season"><option value="" ${selectedSeason ? '' : 'selected'}>未設定</option>${SEASONS.map(season => `<option value="${season}" ${season === selectedSeason ? 'selected' : ''}>${season}</option>`).join('')}</select></div>
      <div class="field"><label for="link">リンク</label><input id="link" name="link" type="url" inputmode="url" value="${escapeHtml(recipe.link)}" placeholder="https://..." /></div>
      <div class="field"><label for="notes">備考</label><textarea id="notes" name="notes" maxlength="1000" placeholder="気になったポイントなどをメモできます">${escapeHtml(recipe.notes)}</textarea></div>
      <div class="field"><label>タグ</label><div class="tag-picker" id="tag-picker">${tags().map(tag => `<button type="button" class="tag-choice ${selected.has(tag) ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
        <div class="new-tag-inline"><input id="new-tag" maxlength="30" placeholder="新しいタグ名" /><button type="button" class="secondary-button" data-action="add-tag-form">＋ 作成</button></div></div>
      <button class="primary-button" type="submit">保存</button></form>`;
    document.querySelector('#recipe-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const data = { id: recipe.id || uid(), name: form.get('name').trim(), location: form.get('location'), link: form.get('link').trim(), notes: form.get('notes').trim(), tags: [...document.querySelectorAll('.tag-choice.selected')].map(x => x.dataset.tag), season: form.get('season') || '', updatedAt: Date.now() };
      const all = recipes(); const index = all.findIndex(item => item.id === data.id);
      if (index === -1) all.push(data); else all[index] = data;
      saveRecipes(all); state = { view: 'detail', recipeId: data.id, search: '', notice: '保存しました。' }; render();
    });
  }

  function renderAllRecipes() {
    const all = [...recipes()].sort((a, b) => b.updatedAt - a.updatedAt);
    app.innerHTML = `${header('登録した料理')}${notice()}<section><div class="section-heading"><h2>すべての料理</h2><span class="meta">${all.length}件</span></div>
      <div class="recipe-list">${all.length ? all.map(recipeCard).join('') : '<div class="empty">まだ料理が登録されていません</div>'}</div></section>`;
  }

  function todayCandidates(season) {
    return recipes().filter(recipe => season === '通年' ? recipe.season === '通年' : (recipe.season === season || recipe.season === '通年'));
  }

  function shuffled(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function chooseToday(season, previousIds = []) {
    const candidates = todayCandidates(season);
    let selected = shuffled(candidates).slice(0, 3);
    if (candidates.length > 3) {
      for (let attempts = 0; attempts < 8 && selected.map(recipe => recipe.id).sort().join('|') === [...previousIds].sort().join('|'); attempts += 1) selected = shuffled(candidates).slice(0, 3);
      if (selected.map(recipe => recipe.id).sort().join('|') === [...previousIds].sort().join('|')) {
        const replacement = candidates.find(recipe => !previousIds.includes(recipe.id));
        const retained = previousIds.slice(0, 2).map(id => candidates.find(recipe => recipe.id === id)).filter(Boolean);
        if (replacement && retained.length === 2) selected = [...retained, replacement];
      }
    }
    state = { view: 'today', recipeId: null, search: '', notice: '', season, todaySeason: season, todayRecipeIds: selected.map(recipe => recipe.id) };
    render();
  }

  function renderToday() {
    const season = state.todaySeason || '通年';
    const recipesById = new Map(recipes().map(recipe => [recipe.id, recipe]));
    const selected = state.todayRecipeIds.map(id => recipesById.get(id)).filter(Boolean);
    const count = todayCandidates(season).length;
    app.innerHTML = `${header('今日なに作る？')}${notice()}<section class="today-card"><p class="meta">${escapeHtml(season)}の料理から選びました。${season !== '通年' ? '（通年の料理を含みます）' : ''}</p>
      ${count < 3 ? `<p class="small-count">この条件の料理は${count}件しか登録されていません。</p>` : ''}
      <div class="recipe-list">${selected.length ? selected.map(todayRecipeCard).join('') : '<div class="empty">この条件に合う料理はまだ登録されていません。</div>'}</div>
      <div class="actions"><button class="primary-button" data-action="repick-today">もう一度選ぶ</button></div></section>`;
  }

  function renderDetail(recipe) {
    if (!recipe) { state = { view: 'home', recipeId: null, search: '', notice: '料理が見つかりませんでした。' }; return render(); }
    const link = safeLink(recipe.link);
    app.innerHTML = `${header('料理の詳細')}${notice()}<article class="detail-card"><h2>${escapeHtml(recipe.name)}</h2>
      <div class="detail-row"><span class="detail-label">保存場所</span><span class="detail-value">${escapeHtml(recipe.location)}</span></div>
      <div class="detail-row"><span class="detail-label">季節</span><span class="detail-value">${escapeHtml(recipe.season || '未設定')}</span></div>
      <div class="detail-row"><span class="detail-label">リンク</span><span class="detail-value">${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>` : '未登録'}</span></div>
      <div class="detail-row"><span class="detail-label">備考</span><span class="detail-value">${recipe.notes ? escapeHtml(recipe.notes).replace(/\n/g, '<br>') : '未登録'}</span></div>
      <div class="detail-row"><span class="detail-label">タグ</span>${tagPills(recipe.tags)}</div></article>
      ${link ? '<p><a class="primary-button" style="display:flex;align-items:center;justify-content:center;text-decoration:none" target="_blank" rel="noopener" href="' + escapeHtml(link) + '">レシピを開く</a></p>' : ''}
      <div class="actions"><button class="secondary-button" data-action="edit" data-id="${recipe.id}">編集</button><button class="danger-button" data-action="delete-recipe" data-id="${recipe.id}">削除</button></div>`;
  }

  function renderTagManager() {
    const allTags = tags();
    app.innerHTML = `${header('タグ管理')}${notice()}<div class="new-tag-inline"><input id="new-tag-manager" maxlength="30" placeholder="新しいタグ名" /><button class="primary-button" data-action="add-tag-manager">＋ 作成</button></div>
      <p class="meta">タグを削除しても、料理自体は削除されません。</p><div class="tag-manager-list">${allTags.length ? allTags.map(tag => `<div class="tag-manager-item"><span>${escapeHtml(tag)}</span><button data-action="delete-tag" data-tag="${escapeHtml(tag)}">削除</button></div>`).join('') : '<div class="empty">登録済みのタグはありません。</div>'}</div>`;
  }

  function renderLocationManager() {
    const allLocations = locations();
    app.innerHTML = `${header('保存場所の管理')}${notice()}<div class="new-tag-inline"><input id="new-location" maxlength="30" placeholder="新しい保存場所" /><button class="primary-button" data-action="add-location">＋ 追加</button></div>
      <p class="meta">削除しても、すでに登録した料理の保存場所は変更されません。</p><div class="tag-manager-list">${allLocations.length ? allLocations.map(location => `<div class="tag-manager-item"><span>${escapeHtml(location)}</span><button data-action="delete-location" data-location="${escapeHtml(location)}">削除</button></div>`).join('') : '<div class="empty">登録済みの保存場所はありません。</div>'}</div>`;
  }

  function renderBackup() {
    app.innerHTML = `${header('バックアップ・復元')}${notice()}<section class="backup-card"><h2>データをバックアップ</h2><p>料理、タグ、保存場所の設定をJSONファイルに書き出します。</p><button class="primary-button" data-action="export-backup">バックアップを書き出す</button></section>
      <section class="backup-card"><h2>データを復元</h2><p>以前書き出したバックアップファイルを選んで復元します。現在のデータは上書きされます。</p><input id="backup-file" type="file" accept="application/json,.json" hidden /><button class="secondary-button" data-action="import-backup">バックアップを読み込む</button></section>`;
  }

  function normalizedList(items) {
    return [...new Set(items.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
  }

  function createBackup() {
    return { app: APP_NAME, version: 1, createdAt: new Date().toISOString(), recipes: recipes(), tags: tags(), locations: locations() };
  }

  function downloadBackup() {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recipe-dokodakke-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    state.error = '';
    state.notice = 'バックアップファイルを書き出しました。';
    render();
  }

  function validateBackup(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.recipes) || !Array.isArray(data.tags) || !Array.isArray(data.locations)) throw new Error('バックアップファイルの形式が正しくありません。');
    const validRecipes = data.recipes.every(recipe => recipe && typeof recipe === 'object' && typeof recipe.name === 'string' && typeof recipe.location === 'string' && Array.isArray(recipe.tags));
    if (!validRecipes) throw new Error('料理データの形式が正しくありません。');
    return {
      recipes: data.recipes.map(recipe => ({ ...recipe, id: String(recipe.id || uid()), name: recipe.name.trim(), location: recipe.location.trim(), link: typeof recipe.link === 'string' ? recipe.link : '', notes: typeof recipe.notes === 'string' ? recipe.notes : '', tags: normalizedList(recipe.tags), season: SEASONS.includes(recipe.season) ? recipe.season : '', updatedAt: Number(recipe.updatedAt) || Date.now() })),
      tags: normalizedList(data.tags),
      locations: normalizedList(data.locations)
    };
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = validateBackup(JSON.parse(reader.result));
        if (!confirm('現在の料理、タグ、保存場所のデータを上書きして復元しますか？')) return;
        saveRecipes(imported.recipes);
        saveTags(imported.tags);
        saveLocations(imported.locations);
        state = { view: 'home', recipeId: null, search: '', notice: 'バックアップからデータを復元しました。' };
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'バックアップの読み込みに失敗しました。';
        render();
      }
    };
    reader.onerror = () => { state.error = 'ファイルを読み込めませんでした。'; render(); };
    reader.readAsText(file);
  }

  function render() {
    state.notice = state.notice || '';
    if (state.view === 'home') return renderHome();
    if (state.view === 'all-recipes') return renderAllRecipes();
    if (state.view === 'today') return renderToday();
    if (state.view === 'form') return renderForm();
    if (state.view === 'edit') return renderForm(recipes().find(item => item.id === state.recipeId));
    if (state.view === 'detail') return renderDetail(recipes().find(item => item.id === state.recipeId));
    if (state.view === 'tags') return renderTagManager();
    if (state.view === 'locations') return renderLocationManager();
    if (state.view === 'backup') return renderBackup();
  }

  function addTag(inputId) {
    const input = document.querySelector(inputId); const value = input.value.trim();
    if (!value) return;
    const isNew = !tags().includes(value);
    if (isNew) saveTags([...tags(), value]);
    input.value = '';
    if (inputId === '#new-tag') {
      if (isNew) document.querySelector('#tag-picker').insertAdjacentHTML('beforeend', `<button type="button" class="tag-choice selected" data-tag="${escapeHtml(value)}">${escapeHtml(value)}</button>`);
      else document.querySelectorAll('.tag-choice').forEach(choice => { if (choice.dataset.tag === value) choice.classList.add('selected'); });
      return;
    }
    state.notice = `「${value}」を追加しました。`;
    render();
  }

  function addLocation() {
    const input = document.querySelector('#new-location'); const value = input.value.trim();
    if (!value) return;
    if (!locations().includes(value)) saveLocations([...locations(), value]);
    state.notice = `「${value}」を追加しました。`;
    state.error = '';
    render();
  }

  app.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'home') { state = { view: 'home', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'new-recipe') { state = { view: 'form', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'all-recipes') { state = { view: 'all-recipes', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'select-season') { state.season = target.dataset.season; renderHome(); }
    if (action === 'pick-today') chooseToday(state.season || '通年');
    if (action === 'repick-today') chooseToday(state.todaySeason || '通年', state.todayRecipeIds || []);
    if (action === 'manage-tags') { state = { view: 'tags', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'manage-locations') { state = { view: 'locations', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'backup') { state = { view: 'backup', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'detail') { state = { view: 'detail', recipeId: target.dataset.id, search: '', notice: '' }; render(); }
    if (action === 'edit') { state = { view: 'edit', recipeId: target.dataset.id, search: '', notice: '' }; render(); }
    if (action === 'add-tag-form') addTag('#new-tag');
    if (action === 'add-tag-manager') addTag('#new-tag-manager');
    if (action === 'add-location') addLocation();
    if (action === 'export-backup') downloadBackup();
    if (action === 'import-backup') document.querySelector('#backup-file').click();
    if (action === 'delete-recipe' && confirm('この料理を削除しますか？')) { saveRecipes(recipes().filter(item => item.id !== target.dataset.id)); state = { view: 'home', recipeId: null, search: '', notice: '料理を削除しました。' }; render(); }
    if (action === 'delete-tag' && confirm(`「${target.dataset.tag}」を削除しますか？`)) { const tag = target.dataset.tag; saveTags(tags().filter(item => item !== tag)); saveRecipes(recipes().map(recipe => ({ ...recipe, tags: recipe.tags.filter(item => item !== tag) }))); state.notice = `「${tag}」を削除しました。`; render(); }
    if (action === 'delete-location' && confirm(`「${target.dataset.location}」を保存場所の候補から削除しますか？\n登録済みの料理の保存場所は変更されません。`)) { const location = target.dataset.location; saveLocations(locations().filter(item => item !== location)); state.notice = `「${location}」を削除しました。`; render(); }
  });
  app.addEventListener('click', event => { const choice = event.target.closest('.tag-choice'); if (choice) choice.classList.toggle('selected'); });
  app.addEventListener('change', event => {
    if (event.target.id !== 'backup-file') return;
    const [file] = event.target.files;
    event.target.value = '';
    if (file) importBackup(file);
  });
  render();
})();
