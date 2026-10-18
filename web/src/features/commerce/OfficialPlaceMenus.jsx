import { Icon } from '../../ui/Icon.jsx';
import { officialMenuSources } from '../../lib/officialMenuSources.js';
import '../../styles/official-place-menus.css';

export function OfficialPlaceMenus({ place }) {
  const source = officialMenuSources(place);
  if (!source) return null;
  return <section class="official-place-menus" aria-label={`${source.venue} — ოფიციალური მენიუ`}>
    <div class="official-menu-heading"><span><Icon name="fork-knife" size={22}/></span><div><h3>ოფიციალური მენიუ</h3><small>{source.venue}</small></div></div>
    <p>{source.note}</p>
    <div class="official-menu-links">{source.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"><span>{link.title}</span><Icon name="arrow-up-right" size={17}/></a>)}</div>
    <p class="official-menu-date">{source.dateNote}</p>
    <footer><a href={source.publisherUrl} target="_blank" rel="noopener noreferrer">ოფიციალური წყარო</a><span>ბმული შემოწმებულია <time dateTime={source.checkedAt}>{source.checkedAt.split('-').reverse().join('.')}</time></span></footer>
  </section>;
}
