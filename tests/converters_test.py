import io, importlib.util, unittest, zipfile
spec = importlib.util.spec_from_file_location('converter', 'scripts/convert_wearables.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)

class ConvertersTest(unittest.TestCase):
    def test_apple_csv_keeps_metric_semantics(self):
        data = b'date,resting_hr_bpm,hrv_sdnn_ms,respiratory_rate_bpm,spo2_pct,sleep_hours\n2026-09-18,64,45,14,98,7.5\n'
        events = converter.apple_csv(io.BytesIO(data), -4)
        self.assertEqual(len(events), 5)
        self.assertEqual(events[0]['timestamp'], '2026-09-18T04:00:00Z')
        self.assertIn('SDNN', events[1]['source'])
        self.assertNotIn('user_id', events[0])

    def test_apple_xml_aggregates_and_filters_source(self):
        xml = b'''<HealthData><Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Apple Watch" unit="%" value="0.98" startDate="2026-09-18 12:00:00 -0400"/><Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Apple Watch" unit="%" value="0.96" startDate="2026-09-18 13:00:00 -0400"/><Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Another device" unit="%" value="0.5" startDate="2026-09-18 13:00:00 -0400"/></HealthData>'''
        events = converter.apple_xml(io.BytesIO(xml), -4, 'Apple Watch')
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['value'], 97)

    def test_whoop_reads_sparse_inline_cells_and_skips_profile(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as z:
            z.writestr('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Recovery" r:id="rId1"/></sheets></workbook>')
            z.writestr('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
            z.writestr('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>created_at</t></is></c><c r="C1" t="inlineStr"><is><t>hrv_rmssd_ms</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>2026-09-18T12:00:00Z</t></is></c><c r="C2"><v>44</v></c></row></sheetData></worksheet>')
        events = converter.whoop(stream.getvalue(), -4)
        self.assertEqual(events[0]['value'], 44)
        self.assertIn('RMSSD', events[0]['source'])

if __name__ == '__main__': unittest.main()
