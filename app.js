(() => {
  'use strict';

  const KEYS = { recipes: 'cooking-memo-recipes-v1', tags: 'cooking-memo-tags-v1' };
  const LOCATIONS = ['YouTube', 'Instagram', 'Xのブックマーク', 'ブックマーク', '画像', 'その他'];
  const app = document.querySelector('#app');
  let state = { view: 'home', recipeId: null, search: '', notice: '' };

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  };
  const recipes = () => read(KEYS.recipes);
  const tags = () => read(KEYS.tags);
  const saveRecipes = (items) => localStorage.setItem(KEYS.recipes, JSON.stringify(items));
  const saveTags = (items) => localStorage.setItem(KEYS.tags, JSON.stringify(items));
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safeLink = (value) => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const tagPills = (list = []) => list.length ? `<div class="tags">${list.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : '';
  const recipeCard = (recipe) => `<button class="recipe-card" data-action="detail" data-id="${recipe.id}"><h3>${escapeHtml(recipe.name)}</h3><div class="meta">保存場所：${escapeHtml(recipe.location)}</div>${tagPills(recipe.tags)}</button>`;
  const header = (title, back = true, right = '') => `<header class="topbar">${back ? '<button class="back-button" data-action="home">‹ 戻る</button>' : '<h1>料理メモ</h1>'}<h1${back ? '' : ' class="visually-hidden"'}>${back ? escapeHtml(title) : ''}</h1>${right}</header>`;
  const notice = () => state.notice ? `<p class="notice">${escapeHtml(state.notice)}</p>` : '';

  function renderHome() {
    const keyword = state.search.trim().toLocaleLowerCase();
    const matching = recipes().filter(recipe => !keyword || [recipe.name, recipe.location, recipe.notes, ...(recipe.tags || [])]
      .some(value => String(value).toLocaleLowerCase().includes(keyword)));
    const sorted = [...matching].sort((a, b) => b.updatedAt - a.updatedAt);
    const displayed = state.search ? sorted : sorted.slice(0, 8);
    app.innerHTML = `<header class="topbar"><h1>料理メモ</h1><button class="icon-button" data-action="manage-tags">タグ管理</button></header>
      ${notice()}<div class="search-wrap"><span>⌕</span><input id="search" type="search" autocomplete="off" placeholder="料理名・タグ・保存場所で検索" value="${escapeHtml(state.search)}" /></div>
      <button class="primary-button" data-action="new-recipe">＋ 料理を登録</button>
      <section><div class="section-heading"><h2>${state.search ? '検索結果' : '最近登録した料理'}</h2>${state.search ? `<span class="meta">${displayed.length}件</span>` : ''}</div>
      <div id="results" class="recipe-list">${displayed.length ? displayed.map(recipeCard).join('') : `<div class="empty">${state.search ? '該当する料理が見つかりませんでした。' : 'まだ料理メモがありません。<br>「＋ 料理を登録」から始めましょう。'}</div>`}</div></section>`;
    const search = document.querySelector('#search');
    search.addEventListener('input', (event) => { state.search = event.target.value; renderHome(); document.querySelector('#search').focus(); });
  }

  function renderForm(editing = null) {
    const recipe = editing || { name: '', location: LOCATIONS[0], link: '', notes: '', tags: [] };
    const selected = new Set(recipe.tags || []);
    app.innerHTML = `${header(editing ? '料理を編集' : '料理を登録')}${notice()}<form id="recipe-form" class="form">
      <div class="field"><label for="name">料理名 <span class="required">必須</span></label><input id="name" name="name" required maxlength="100" value="${escapeHtml(recipe.name)}" placeholder="例：鶏肉とキャベツの炒め物" /></div>
      <div class="field"><label for="location">保存場所 <span class="required">必須</span></label><select id="location" name="location">${LOCATIONS.map(x => `<option ${x === recipe.location ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="link">リンク</label><input id="link" name="link" type="url" inputmode="url" value="${escapeHtml(recipe.link)}" placeholder="https://..." /></div>
      <div class="field"><label for="notes">備考</label><textarea id="notes" name="notes" maxlength="1000" placeholder="気になったポイントなどをメモできます">${escapeHtml(recipe.notes)}</textarea></div>
      <div class="field"><label>タグ</label><div class="tag-picker" id="tag-picker">${tags().map(tag => `<button type="button" class="tag-choice ${selected.has(tag) ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
        <div class="new-tag-inline"><input id="new-tag" maxlength="30" placeholder="新しいタグ名" /><button type="button" class="secondary-button" data-action="add-tag-form">＋ 作成</button></div></div>
      <button class="primary-button" type="submit">保存</button></form>`;
    document.querySelector('#recipe-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const data = { id: recipe.id || uid(), name: form.get('name').trim(), location: form.get('location'), link: form.get('link').trim(), notes: form.get('notes').trim(), tags: [...document.querySelectorAll('.tag-choice.selected')].map(x => x.dataset.tag), updatedAt: Date.now() };
      const all = recipes(); const index = all.findIndex(item => item.id === data.id);
      if (index === -1) all.push(data); else all[index] = data;
      saveRecipes(all); state = { view: 'detail', recipeId: data.id, search: '', notice: '保存しました。' }; render();
    });
  }

  function renderDetail(recipe) {
    if (!recipe) { state = { view: 'home', recipeId: null, search: '', notice: '料理が見つかりませんでした。' }; return render(); }
    const link = safeLink(recipe.link);
    app.innerHTML = `${header('料理の詳細')}${notice()}<article class="detail-card"><h2>${escapeHtml(recipe.name)}</h2>
      <div class="detail-row"><span class="detail-label">保存場所</span><span class="detail-value">${escapeHtml(recipe.location)}</span></div>
      <div class="detail-row"><span class="detail-label">リンク</span><span class="detail-value">${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>` : '未登録'}</span></div>
      <div class="detail-row"><span class="detail-label">備考</span><span class="detail-value">${recipe.notes ? escapeHtml(recipe.notes).replace(/\n/g, '<br>') : '未登録'}</span></div>
      <div class="detail-row"><span class="detail-label">タグ</span>${tagPills(recipe.tags)}</div></article>
      ${link ? '<p><a class="primary-button" style="display:flex;align-items:center;justify-content:center;text-decoration:none" target="_blank" rel="noopener" href="' + escapeHtml(link) + '">レシピを開く</a></p>' : ''}
      <div class="actions"><button class="secondary-button" data-action="edit" data-id="${recipe.id}">編集</button><button class="danger-button" data-action="delete-recipe" data-id="${recipe.id}">削除</button></div>`;
  }

  function renderTagManager() {
    const allTags = tags();
    app.innerHTML = `${header('タグ管理')}${notice()}<div class="new-tag-inline"><input id="new-tag-manager" maxlength="30" placeholder="新しいタグ名" /><button class="primary-button" data-action="add-tag-manager">＋ 作成</button></div>
      <p class="meta">タグを削除しても、料理メモ自体は削除されません。</p><div class="tag-manager-list">${allTags.length ? allTags.map(tag => `<div class="tag-manager-item"><span>${escapeHtml(tag)}</span><button data-action="delete-tag" data-tag="${escapeHtml(tag)}">削除</button></div>`).join('') : '<div class="empty">登録済みのタグはありません。</div>'}</div>`;
  }

  function render() {
    state.notice = state.notice || '';
    if (state.view === 'home') return renderHome();
    if (state.view === 'form') return renderForm();
    if (state.view === 'edit') return renderForm(recipes().find(item => item.id === state.recipeId));
    if (state.view === 'detail') return renderDetail(recipes().find(item => item.id === state.recipeId));
    if (state.view === 'tags') return renderTagManager();
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

  app.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'home') { state = { view: 'home', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'new-recipe') { state = { view: 'form', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'manage-tags') { state = { view: 'tags', recipeId: null, search: '', notice: '' }; render(); }
    if (action === 'detail') { state = { view: 'detail', recipeId: target.dataset.id, search: '', notice: '' }; render(); }
    if (action === 'edit') { state = { view: 'edit', recipeId: target.dataset.id, search: '', notice: '' }; render(); }
    if (action === 'add-tag-form') addTag('#new-tag');
    if (action === 'add-tag-manager') addTag('#new-tag-manager');
    if (action === 'delete-recipe' && confirm('この料理メモを削除しますか？')) { saveRecipes(recipes().filter(item => item.id !== target.dataset.id)); state = { view: 'home', recipeId: null, search: '', notice: '料理メモを削除しました。' }; render(); }
    if (action === 'delete-tag' && confirm(`「${target.dataset.tag}」を削除しますか？`)) { const tag = target.dataset.tag; saveTags(tags().filter(item => item !== tag)); saveRecipes(recipes().map(recipe => ({ ...recipe, tags: recipe.tags.filter(item => item !== tag) }))); state.notice = `「${tag}」を削除しました。`; render(); }
  });
  app.addEventListener('click', event => { const choice = event.target.closest('.tag-choice'); if (choice) choice.classList.toggle('selected'); });
  render();
})();
