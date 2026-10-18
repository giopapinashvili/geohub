import { TextField } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import '../../styles/place-coordinates.css';

export function CoordinateFields({ value, onChange, error = false }) {
  return (
    <fieldset class="place-coordinate-fields">
      <legend>{t('place.coordinates')}</legend>
      <p class="field-hint">{t('place.coordinatesHint')}</p>
      <div class="form-2">
        <TextField label={t('place.latitude')} value={value.lat ?? ''} inputMode="decimal" maxLength={24} placeholder="41.7097" error={error ? t('place.coordinatesInvalid') : undefined} onInput={(event) => onChange({ ...value, lat: event.currentTarget.value })} />
        <TextField label={t('place.longitude')} value={value.lng ?? ''} inputMode="decimal" maxLength={24} placeholder="44.8029" aria-invalid={error ? 'true' : undefined} onInput={(event) => onChange({ ...value, lng: event.currentTarget.value })} />
      </div>
    </fieldset>
  );
}
