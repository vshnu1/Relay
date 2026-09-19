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

spec_parse = importlib.util.spec_from_file_location('parse_export', 'pipeline/parse_export.py')
parse_export = importlib.util.module_from_spec(spec_parse)
spec_parse.loader.exec_module(parse_export)
spec_agg = importlib.util.spec_from_file_location('aggregate', 'pipeline/aggregate.py')
aggregate = importlib.util.module_from_spec(spec_agg)
spec_agg.loader.exec_module(aggregate)


class PipelineUnitsTest(unittest.TestCase):
    def test_unit_is_captured_wherever_it_sits_in_the_record(self):
        # HealthKit writes unit after sourceName and device. The parser once
        # looked for it only before sourceName, so every event lost its unit,
        # and nothing noticed until gait, whose values need converting.
        import os, tempfile
        xml = ('<HealthData>\n<Record type="HKQuantityTypeIdentifierWalkingSpeed" sourceName="Phone" '
               'sourceVersion="1" device="x" unit="mi/hr" creationDate="2026-09-18 08:00:00 -0400" '
               'startDate="2026-09-18 08:00:00 -0400" endDate="2026-09-18 08:00:05 -0400" value="2.2"/>\n</HealthData>\n')
        with tempfile.NamedTemporaryFile('w', suffix='.xml', delete=False) as handle:
            handle.write(xml)
            path = handle.name
        try:
            events = list(parse_export.parse(path))
        finally:
            os.unlink(path)
        self.assertEqual(events[0]['signal'], 'walking_speed')
        self.assertEqual(events[0]['unit'], 'mi/hr')

    def test_gait_values_land_in_one_unit(self):
        self.assertAlmostEqual(aggregate.gait_value('walking_speed', 2.2, 'mi/hr'), 0.983, places=3)
        self.assertAlmostEqual(aggregate.gait_value('step_length', 23.5, 'in'), 59.69, places=2)
        self.assertAlmostEqual(aggregate.gait_value('double_support', 0.289, '%'), 28.9, places=6)
        self.assertAlmostEqual(aggregate.gait_value('double_support', 28.9, '%'), 28.9, places=6)


if __name__ == '__main__': unittest.main()
