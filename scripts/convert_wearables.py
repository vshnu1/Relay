#!/usr/bin/env python3
"""Offline wearable conversion. Writes measurements only, never profile/identity fields.
The output remains health data; stripping identifiers is NOT formal de-identification.
"""
import argparse, csv, io, json, statistics, zipfile, posixpath
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

UNITS = {'rhr': 'bpm', 'hrv': 'ms', 'respiratory': '/min', 'sleep': 'h', 'spo2': '%', 'glucose': 'mg/dL'}
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def timestamp(value, offset):
    if not value: return None
    if isinstance(value, (int, float)) or str(value).replace('.', '', 1).isdigit():
        dt = datetime(1899, 12, 30) + timedelta(days=float(value))
    else:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if dt.tzinfo is None:
        tz = timezone(timedelta(hours=float(offset)))
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

def emit(records, metric, value, time, source):
    try: value = float(value)
    except (ValueError, TypeError): return
    if not time or value <= 0 or value > 1000: return
    records.append({'metric': metric, 'value': round(value, 3), 'unit': UNITS[metric], 'timestamp': time, 'source': source})

def apple_csv(stream, offset):
    records = []
    mapping = {'resting_hr_bpm': 'rhr', 'hrv_sdnn_ms': 'hrv', 'respiratory_rate_bpm': 'respiratory', 'spo2_pct': 'spo2', 'sleep_hours': 'sleep'}
    for row in csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig')):
        for field, metric in mapping.items():
            emit(records, metric, row.get(field), timestamp(row.get('date'), offset), 'Apple Watch daily export' + (' · SDNN' if metric == 'hrv' else ''))
    return records

def sheets(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {n.get('Id'): n.get('Target') for n in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            if sheet.get('name') not in ('Recovery', 'Sleep'): continue
            target = rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            path = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            rows = []
            for row in ET.fromstring(z.read(path)).findall('m:sheetData/m:row', NS):
                values = {}
                for cell in row:
                    key = ''.join(c for c in cell.get('r', '') if c.isalpha())
                    val = cell.find('m:v', NS)
                    text = val.text if val is not None else ''.join(cell.itertext())
                    values[key] = strings[int(text)] if cell.get('t') == 's' else text
                rows.append(values)
            if rows:
                header = rows[0]
                yield sheet.get('name'), [{header.get(k, k): v for k, v in row.items()} for row in rows[1:]]

def whoop(data, offset):
    records = []
    for name, rows in sheets(data):
        mapping = {'resting_heart_rate_bpm': 'rhr', 'hrv_rmssd_ms': 'hrv', 'spo2_percentage': 'spo2'} if name == 'Recovery' else {'respiratory_rate': 'respiratory', 'total_sleep_hours': 'sleep'}
        for row in rows:
            if str(row.get('nap', '')).lower() in ('1', 'true'): continue
            # Recoveries use export creation time; retain this explicit limitation in metadata.
            time = timestamp(row.get('end') or row.get('created_at'), offset)
            for field, metric in mapping.items():
                emit(records, metric, row.get(field), time, 'WHOOP export' + (' · RMSSD' if metric == 'hrv' else ''))
    return records

def apple_xml(stream, offset, source_filter=None):
    mapping = {'HKQuantityTypeIdentifierRestingHeartRate': ('rhr', 'count/min'), 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': ('hrv', 'ms'), 'HKQuantityTypeIdentifierRespiratoryRate': ('respiratory', 'count/min'), 'HKQuantityTypeIdentifierOxygenSaturation': ('spo2', '%'), 'HKQuantityTypeIdentifierBloodGlucose': ('glucose', 'mg/dL')}
    groups = defaultdict(list)
    for _, node in ET.iterparse(stream, events=('end',)):
        if node.tag == 'Record' and node.get('type') in mapping:
            if source_filter and source_filter.lower() not in node.get('sourceName', '').lower():
                node.clear(); continue
            metric, unit = mapping[node.get('type')]
            if node.get('unit') != unit: node.clear(); continue
            try:
                dt = datetime.strptime(node.get('startDate'), '%Y-%m-%d %H:%M:%S %z')
                day = dt.date().isoformat()
                value = float(node.get('value'))
                if metric == 'spo2': value *= 100
                if 0 < value <= 1000: groups[(day, metric)].append(value)
            except (ValueError, TypeError): pass
        node.clear()
    records = []
    for (day, metric), values in groups.items():
        emit(records, metric, statistics.mean(values), timestamp(day, offset), 'Apple Health daily aggregate' + (' · SDNN' if metric == 'hrv' else ''))
    return records

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--format', choices=['apple-csv', 'whoop-xlsx', 'apple-xml'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--timezone-offset', type=float, required=True, help='Hours from UTC for date-only records, e.g. -4. Explicit fixed offset; split exports across DST changes.')
    parser.add_argument('--source-filter', help='Apple XML source-name substring. Filter to one device to avoid mixed-device baselines.')
    args = parser.parse_args()
    def convert(stream):
        if args.format == 'apple-csv': return apple_csv(stream, args.timezone_offset)
        if args.format == 'whoop-xlsx': return whoop(stream.read(), args.timezone_offset)
        return apple_xml(stream, args.timezone_offset, args.source_filter)
    if args.input.suffix.lower() == '.zip':
        with zipfile.ZipFile(args.input) as z:
            suffix = {'apple-csv': '.csv', 'whoop-xlsx': '.xlsx', 'apple-xml': 'export.xml'}[args.format]
            names = [n for n in z.namelist() if n.endswith(suffix) and not n.startswith('__MACOSX')]
            if len(names) != 1: raise SystemExit(f'Expected one matching file; found {len(names)}. Supply an extracted file instead.')
            with z.open(names[0]) as stream: records = convert(stream)
    else:
        with args.input.open('rb') as stream: records = convert(stream)
    # Exact duplicate timestamps are combined only within one device export.
    grouped = defaultdict(list)
    for record in records: grouped[(record['metric'], record['timestamp'], record['source'])].append(record['value'])
    records = [{'metric': m, 'timestamp': t, 'source': s, 'value': round(statistics.mean(v), 3), 'unit': UNITS[m]} for (m,t,s),v in grouped.items()]
    records.sort(key=lambda r: r['timestamp'])
    if len(records) > 10000: raise SystemExit('More than 10,000 records. Select a shorter date range before importing.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'classification': 'unreviewed-health-data', 'events': records}, indent=2))
    args.output.chmod(0o600)
    print(f'Converted {len(records)} measurements into {args.output}. Review classification and privacy before importing. Never commit real health data.')
if __name__ == '__main__': main()
