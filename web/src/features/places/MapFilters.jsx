import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';
import { PLACE_GROUPS, PLACE_TAXONOMY } from '../../lib/placeTaxonomy.js';
import { EMPTY_PLACE_FILTERS, placeFilterCount } from '../../lib/discoveryFilters.js';
import { REVIEW_EXPERIENCE_TAGS } from '../../lib/reviewTags.js';
import '../../styles/map-filters.css';

const QUICK = ['food', 'shopping', 'entertainment', 'nature', 'health', 'transport'];
export function MapFilters({ category, onCategory, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const count = placeFilterCount(value);
  const selected = PLACE_TAXONOMY.find((c) => c.id === category) || PLACE_GROUPS.find((g) => g.id === category);
  return <>
    <div class="map-filter-top"><button type="button" class={`chip${category === 'all' ? ' is-active' : ''}`} aria-pressed={category === 'all'} onClick={() => onCategory('all')}>{t('common.all')}</button>
      <button type="button" class={`chip${count || category !== 'all' ? ' is-active' : ''}`} onClick={() => setOpen(true)}><Icon name="sliders-horizontal" size={17} />{t('map.filters')}{count > 0 && <span class="map-filter-count">{count}</span>}</button>
      {selected && !QUICK.includes(category) && <span class="tag tag-brand">{selected.label}</span>}
    </div>
    <div class="map-chips" role="group" aria-label={t('place.category')}>{PLACE_GROUPS.filter((g) => QUICK.includes(g.id)).map((g) => <button key={g.id} type="button" class={`chip${category === g.id ? ' is-active' : ''}`} aria-pressed={category === g.id} onClick={() => onCategory(category === g.id ? 'all' : g.id)}><Icon name={g.icon} size={16} style={{ color: g.tone }} />{g.label}</button>)}</div>
    {open && <Modal open onClose={() => setOpen(false)} title={t('map.filters')} size="md" footer={<><Button onClick={() => { onChange({ ...EMPTY_PLACE_FILTERS }); onCategory('all'); }}>{t('deals.reset')}</Button><Button variant="primary" onClick={() => setOpen(false)}>{t('map.showResults')}</Button></>}>
      <div class="map-filter-form">
        <label for="map-category-search">{t('map.findCategory')}</label><input id="map-category-search" class="input" type="search" value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
        <div class="map-category-grid" role="group" aria-label={t('place.category')}>
          {!search && PLACE_GROUPS.map((g) => <button key={`group-${g.id}`} type="button" class={`map-category-group${category === g.id ? ' is-active' : ''}`} aria-pressed={category === g.id} onClick={() => onCategory(g.id)}><Icon name={g.icon} size={20} style={{ color: g.tone }} /><span>{g.label}</span></button>)}
          {PLACE_TAXONOMY.filter((c) => search ? `${c.label} ${c.id}`.toLowerCase().includes(search.toLowerCase()) : category !== 'all' && (c.group === category || c.group === selected?.group)).map((c) => <button key={c.id} type="button" class={`map-category-option${category === c.id ? ' is-active' : ''}`} aria-pressed={category === c.id} onClick={() => onCategory(c.id)}><Icon name={c.icon} size={17} /><span>{c.label}</span></button>)}
        </div>
        <fieldset><legend>{t('map.attributes')}</legend><p class="muted small">{t('map.knownOnly')}</p><div class="map-attribute-grid">
          {['children','gaming','wheelchair','parking','outdoor','indoor','wifi','takeaway','delivery','free'].map((key) => <label key={key}><input type="checkbox" checked={value[key]} onChange={(e) => onChange({ ...value, [key]: e.currentTarget.checked })} /><span>{t(`map.filter.${key}`)}</span></label>)}
        </div></fieldset>
        <label for="map-diet">{t('commerce.diet')}</label><select id="map-diet" class="input" value={value.diet} onChange={(e) => onChange({ ...value, diet: e.currentTarget.value })}><option value="">{t('common.all')}</option>{['vegetarian','vegan','halal','kosher','gluten-free','lactose-free','dairy-free'].map((key) => <option key={key} value={key}>{t(`commerce.diet.${key}`)}</option>)}</select>
        <label for="map-preparation">{t('map.preparationFilter')}</label><select id="map-preparation" class="input" value={value.preparationMax} onChange={(e) => onChange({ ...value, preparationMax: e.currentTarget.value })}><option value="">{t('common.all')}</option>{[15,30,60].map(minutes => <option key={minutes} value={minutes}>{t('map.preparationWithin', { n: minutes })}</option>)}</select>
        <label for="map-experience">{t('map.communityFilter')}</label><select id="map-experience" class="input" value={value.experienceTag} onChange={(e) => onChange({ ...value, experienceTag: e.currentTarget.value })}><option value="">{t('common.all')}</option>{REVIEW_EXPERIENCE_TAGS.map(tag => <option key={tag.id} value={tag.id}>{tag.label}</option>)}</select>
        <p class="small muted">{t('map.communityFilterHint')}</p>
      </div>
    </Modal>}
  </>;
}
