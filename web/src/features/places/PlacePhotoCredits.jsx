import '../../styles/place-photo-credits.css';
import { photoDateLabel } from '../../lib/photoDate.js';

export function PlacePhotoCredits({ place }) {
  const credits = place?.raw?.photoCredits || [];
  if (!credits.length) return null;
  return <details class="place-photo-credits">
    <summary>ფოტოების წყაროები და თარიღები · {credits.length}</summary>
    <div><p>ფოტოები ასახავს გადაღების დროს არსებულ მდგომარეობას. ნაჩვენებია შემცირებული, ჩარჩოზე მორგებული პრევიუ.</p>
      <ul>{credits.map((photo) => <li key={photo.url}>
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.caption}</a>
        <span>{photo.rights === 'source-published' ? 'გამომქვეყნებელი: ' : ''}{photo.author} · <span>{photoDateLabel(photo.dateTaken)}</span> · {photo.rights === 'source-published' ? 'გამომქვეყნებლის ცნობარის ფოტო' : <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>}</span>
      </li>)}</ul>
    </div>
  </details>;
}
