"""Gold Standard 모니터링 보고서(MR) 원본 양식(v2.0 .docx)에 MRV 계산 결과를 채워 넣음.

양식 규칙 (원본 첫 장 안내문):
  - 원본 글꼴·제목·로고·표를 그대로 두고, 칸만 채움 (표·열 삭제 금지, 행 추가만 가능)
  - 영어로 작성, 날짜는 DD/MM/YYYY, 숫자는 1,000.00, 모든 숫자에 단위
  - 해당 없는 항목은 "Not Applicable"과 이유
  - 'Delete after filling' 안내문과 칸 안의 작성 안내는 지움
GS 등록 후에만 정해지는 값(GS ID, 인증 기간, 버퍼 등)은 "To be completed upon GS registration"으로 남김.
"""
import copy
import io
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

TEMPLATE = Path(__file__).parent / "assets" / "gs_mr_template_v2.0.docx"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"

TBC = "To be completed upon Gold Standard registration."
METHODOLOGY = "Methodology for Methane Emission Reduction by Adjusted Water Management Practice in Rice Cultivation"
METHODOLOGY_VER = "1.0 (06/07/2023)"

REGIONS = {
    "서울특별시": "Seoul", "부산광역시": "Busan", "대구광역시": "Daegu", "인천광역시": "Incheon",
    "광주광역시": "Gwangju", "대전광역시": "Daejeon", "울산광역시": "Ulsan", "세종특별자치시": "Sejong",
    "경기도": "Gyeonggi-do", "강원특별자치도": "Gangwon-do", "강원도": "Gangwon-do",
    "충청북도": "Chungcheongbuk-do", "충청남도": "Chungcheongnam-do",
    "전북특별자치도": "Jeollabuk-do (Jeonbuk State)", "전라북도": "Jeollabuk-do", "전라남도": "Jeollanam-do",
    "경상북도": "Gyeongsangbuk-do", "경상남도": "Gyeongsangnam-do", "제주특별자치도": "Jeju-do",
}
ORGANIC_EN = {
    "투입 없음": "No organic amendment",
    "볏짚 (재배 30일 이상 전 투입)": "Straw incorporated more than 30 days before cultivation",
    "볏짚 (재배 30일 이내 투입)": "Straw incorporated less than 30 days before cultivation",
    "퇴비": "Compost", "축분": "Farm yard manure", "녹비": "Green manure",
    "기타 (유박 등, 퇴비 계수 적용)": "Other (e.g. oil cake; compost conversion factor applied)",
}
PRESEASON_EN = {
    "180일 미만 비담수": "Non-flooded pre-season shorter than 180 days",
    "180일 이상 비담수": "Non-flooded pre-season longer than 180 days",
    "30일 이상 담수": "Flooded pre-season (more than 30 days)",
    "365일 이상 비담수": "Non-flooded pre-season longer than 365 days",
}
REGIME_EN = {"CONTINUOUS": "Continuously flooded", "SINGLE": "Single drainage period", "MULTIPLE": "Multiple drainage periods"}


# ── 숫자·날짜 형식 (양식 규칙) ──────────────────────────────
def num(v: float, digits: int = 2) -> str:
    return f"{v:,.{digits}f}"


def dmy(d) -> str:
    if isinstance(d, str):
        d = date.fromisoformat(d[:10])
    return d.strftime("%d/%m/%Y")


def dms(deg: float, pos: str, neg: str) -> str:
    a = abs(deg)
    d = int(a)
    m = int((a - d) * 60)
    s = (a - d - m / 60) * 3600
    return f"{d}°{m:02d}'{s:05.2f}\"{pos if deg >= 0 else neg}"


def ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


# ── 양식 다루는 도구 ───────────────────────────────────────
def uniq_cells(row):
    out, prev = [], None
    for c in row.cells:
        if c._tc is not prev:
            out.append(c)
            prev = c._tc
    return out


def write_paragraph(p: Paragraph, text: str):
    """문단 글자를 바꿈 (문단 서식은 유지, 안내문용 기울임·색 글자 서식은 버림)."""
    for child in list(p._p):
        if child.tag != qn("w:pPr"):
            p._p.remove(child)
    p.add_run(text)


def write_lines(p: Paragraph, lines: list[str]):
    """첫 줄은 이 문단에, 나머지 줄은 같은 서식의 문단을 아래에 이어 붙임."""
    write_paragraph(p, lines[0])
    anchor = p._p
    for line in lines[1:]:
        new = copy.deepcopy(p._p)
        anchor.addnext(new)
        anchor = new
        write_paragraph(Paragraph(new, p._parent), line)


def write_cell(cell, text: str | list[str]):
    lines = text if isinstance(text, list) else [text]
    paras = cell.paragraphs
    for extra in paras[1:]:
        extra._p.getparent().remove(extra._p)
    write_lines(paras[0], lines)


def check(el, label: str):
    """el 안에서 label 글자 바로 앞의 체크박스를 체크."""
    for sdt in el.iter(qn("w:sdt")):
        box = sdt.find(f"{qn('w:sdtPr')}/{{{W14}}}checkbox")
        if box is None:
            continue
        # 체크박스 뒤에 이어지는 글자 (다음 체크박스 전까지)
        following = []
        for sib in sdt.itersiblings():
            if sib.tag == qn("w:sdt"):
                break
            following.extend(t.text or "" for t in sib.iter(qn("w:t")))
        if label.lower() in "".join(following).lower():
            box.find(f"{{{W14}}}checked").set(f"{{{W14}}}val", "1")
            for t in sdt.iter(qn("w:t")):
                t.text = "☒"
            return True
    return False


def body_items(doc):
    """본문의 문단·표를 순서대로 (종류, 객체)."""
    for el in doc.element.body.iterchildren():
        if el.tag == qn("w:p"):
            yield "p", Paragraph(el, doc)
        elif el.tag == qn("w:tbl"):
            yield "t", Table(el, doc)


def remove(el):
    el.getparent().remove(el)


# ── 보고서 채우기 ──────────────────────────────────────────
def build_gs_docx(field: dict, mrv: dict, inp: dict) -> bytes:
    doc = Document(str(TEMPLATE))
    f, c, ind = mrv["factors"], mrv["calculation"], mrv["indicators"]
    start, end = inp["start"], inp["end"]
    days = mrv["season_days"]
    area = mrv["area_ha"]
    net = c["net_tco2e"]
    drains = mrv["drain_events"]
    regime = mrv["water_regime"]
    unc_pct = round(f["uncertainty"] * 100)
    interval = mrv.get("interval_min")
    today = datetime.now(timezone(timedelta(hours=9))).date()

    addr = (field.get("jibun_addr") or "").strip()
    region_ko = (inp.get("region") or "").strip() or (addr.split(" ")[0] if addr else "")
    region = REGIONS.get(region_ko, region_ko or "-")
    title = (inp.get("project_title") or "").strip() or \
        f"AWD water management for methane emission reduction in rice paddies ({field['field_name']})"
    operator = (inp.get("operator") or "").strip() or "Not provided"
    if (inp.get("manager") or "").strip():
        operator += f" (contact person: {inp['manager'].strip()})"
    organic = ORGANIC_EN.get(inp.get("organic_type", ""), inp.get("organic_type") or "-")
    if inp.get("organic_amount"):
        organic += f", {num(inp['organic_amount'])} t/ha"
    preseason = PRESEASON_EN.get(inp.get("preseason", ""), inp.get("preseason") or "-")
    period = f"{dmy(start)} to {dmy(end)} (including both start and end dates; {days} days)"
    sensors = ", ".join(mrv["node_names"]) or "-"
    compliance = (f"{num(ind['compliance_rate'], 1)}% ({ind['compliant_events']}/{ind['judged_events']} drainage events)"
                  if ind.get("compliance_rate") is not None else "Not Applicable (no drainage event)")

    # 1) 'Delete after filling' 안내 페이지 지우기: 'Guidelines' 문단부터 'Section by Section instructions'까지
    items = list(body_items(doc))
    in_guide = False
    for kind, obj in items:
        text = obj.text.strip() if kind == "p" else ""
        if kind == "p" and text.startswith("Instructions for completing report"):
            remove(obj._p)
            continue
        if kind == "p" and text.startswith("Guidelines [Delete after filling"):
            in_guide = True
        if in_guide:
            if kind == "p" and obj.style.name == "Heading 1" and text.startswith("KEY PROJECT"):
                break
            if kind == "p" and obj._p.find(qn("w:pPr") + "/" + qn("w:sectPr")) is not None:
                continue  # 구역 나눔 문단은 남김
            remove(obj._p if kind == "p" else obj._tbl)

    t = doc.tables  # 안내 표(Table 1)가 빠져서 번호가 하나씩 당겨짐
    T_HEAD, T_POA, T_KEY, T_SDG, T_VINT, T_BUF, T_LOC, T_CRED, T_FIX, T_MON = range(10)
    T_D3, T_PER, T_SHORT, T_NET, T_EXANTE = 10, 11, 12, 13, 14

    # 2) 표지
    write_cell(t[T_HEAD].rows[0].cells[1], TBC)
    write_cell(t[T_HEAD].rows[1].cells[1], title)

    # 3) PoA 정보: 해당 없음
    for r in t[T_POA].rows:
        write_cell(uniq_cells(r)[1], "Not Applicable – this project is a stand-alone project, not part of a Programme of Activities.")

    # 4) Key Project Information
    key = {
        0: TBC, 1: title, 2: "To be completed upon design certification of the PDD.",
        3: inp.get("version") or "1.0", 4: dmy(today), 5: TBC,
        6: "Not Applicable – no annual report has been submitted before this monitoring report.",
        7: ordinal(int(inp.get("period_no") or 1)), 8: period, 9: operator, 10: "Republic of Korea",
    }
    rows = t[T_KEY].rows
    for i, v in key.items():
        write_cell(uniq_cells(rows[i])[1], v)
    check(rows[11]._tr, "Micro scale")
    check(rows[12]._tr, "Small-holder")
    check(rows[13]._tr, "Emission reductions activity")
    check(rows[14]._tr, "Land")
    check(rows[20]._tr, "GHG Emissions Reduction")
    write_cell(uniq_cells(rows[16])[1], METHODOLOGY)
    write_cell(uniq_cells(rows[16])[2], METHODOLOGY_VER)
    write_cell(uniq_cells(rows[17])[1], "IPCC 2019 Refinement, Vol. 4, Ch. 5.5 (Methane emissions from rice cultivation)")
    write_cell(uniq_cells(rows[17])[2], "2019")

    # 5) Table 1 SDG 기여, Table 2 빈티지, Table 3 버퍼
    r = t[T_SDG].rows[1]
    check(r._tr, "Emission reductions")
    write_cell(uniq_cells(r)[2], num(net, 3))
    write_cell(uniq_cells(r)[3], "GS VERs (tCO2e)")
    r = uniq_cells(t[T_VINT].rows[2])
    for cell, v in zip(r, [dmy(start), dmy(end), f"{num(net, 3)} tCO2e", "Not Applicable", "-"]):
        write_cell(cell, v)
    r = uniq_cells(t[T_BUF].rows[1])
    for cell, v in zip(r, [f"{dmy(start)} - {dmy(end)}", num(net, 3), TBC, TBC, TBC]):
        write_cell(cell, v)

    # 6) 본문 문단: '>>' 안내 자리에 내용 쓰기
    sections = {
        "A.1": [
            f"The project applies Alternate Wetting and Drying (AWD) water management to the rice paddy "
            f"\"{field['field_name']}\" ({num(area, 4)} ha) in {region}, Republic of Korea.",
            f"A water-level sensor installed in the field measures the water level relative to the soil surface "
            f"{f'every {interval} minutes' if interval else 'continuously'} and transmits the data via LoRaWAN to the "
            f"Nonstop monitoring platform. The field is re-irrigated when the water level falls to -15 cm below the soil "
            f"surface, up to +5 cm.",
            f"Methane emission reductions compared with continuous flooding are calculated with the simplified approach "
            f"(IPCC Tier 1 default values) of the Gold Standard \"{METHODOLOGY}\" (Version {METHODOLOGY_VER}).",
        ],
        "A.3": [
            f"Baseline and monitoring methodology: Gold Standard \"{METHODOLOGY}\", Version {METHODOLOGY_VER} – "
            f"simplified approach with IPCC default values (Tier 1).",
            "Methodological guidance referred to: IPCC 2019 Refinement to the 2006 IPCC Guidelines for National "
            "Greenhouse Gas Inventories, Volume 4, Chapter 5.5 (Methane Emissions from Rice Cultivation).",
            "Standardized baselines: Not Applicable – no standardized baseline is applied.",
            "Mandatory GS guidelines: Not Applicable.",
        ],
        "B.1": [
            f"Monitoring period: {period}, from transplanting to harvest.",
            f"The water-level sensor(s) ({sensors}) operated throughout the monitoring period and recorded "
            f"{mrv['sample_count']:,} measurements (median interval: {interval if interval else '-'} min; "
            f"data availability: {num(ind['uptime_rate'], 1) if ind.get('uptime_rate') is not None else '-'}%).",
            f"{len(drains)} drainage event(s) (water level at or below -15 cm) were recorded; the on-season water regime "
            f"is therefore classified as \"{REGIME_EN[regime]}\" (SF_w = {f['sf_w']}).",
            f"AWD compliance (re-irrigation within {ind['compliance_hours']} hours after reaching -15 cm): {compliance}.",
            f"Organic amendment: {organic}. Pre-season water regime: {preseason}.",
        ] + ([f"Notes from the project developer: {inp['memo'].strip()}"] if (inp.get("memo") or "").strip() else []),
        "B.1.1": ["Not Applicable – this is the first monitoring period and no Forward Action Requests have been issued."],
        "B.2.1": ["Not Applicable – there were no temporary deviations during this monitoring period."],
        "B.2.2": ["Not Applicable – no corrections were applied."],
        "B.2.3": ["Not Applicable – no change to the start date of the crediting period."],
        "B.2.4": ["Not Applicable – no permanent changes during this monitoring period."],
        "B.2.5": ["Not Applicable – no changes to the project design."],
        "C": [
            "Monitoring chain: ultrasonic water-level sensor in a perforated field water tube → STM32WL LoRaWAN node "
            "→ LoRaWAN gateway → server (FastAPI) → database (PostgreSQL/PostGIS) → web platform.",
            "Every measurement is stored with its timestamp, sensor ID and raw payload. Data are also published in the "
            "OGC SensorThings API v1.1 format; field location and parcel boundary are stored as OGC Simple Features (WGS84).",
            "Drainage events, the water regime, AWD indicators and emission reductions are calculated automatically on "
            "the server from the stored measurements; no manual data entry is involved.",
            "Alerts are generated for communication loss and for water levels staying outside the AWD range.",
            f"Responsible entity: {operator}.",
        ],
        "D.3": None,  # 표로 처리
        "D.4": ["Not Applicable – no sampling is applied; the water level of the project field is monitored continuously."],
        "D.5": ["Not Applicable – the project is an emission reduction activity and has no removals subject to reversal."],
        "D.6": ["Not Applicable – no Planned Emission Reductions (PERs) have been issued for this activity."],
        "D.6.1": ["Not Applicable – no PERs have been issued."],
        "D.6.2": ["Not Applicable – no PERs have been issued."],
        "E.1": [
            "BE = EF_BL × A × L × 10^-3 × GWP_CH4, with EF_BL = EF_c × SF_w,BL × SF_p × SF_o",
            f"EF_BL = {f['ef_c']} × 1.00 × {f['sf_p']} × {f['sf_o']} = {num(c['ef_bl'], 4)} kgCH4/ha/day",
            f"BE = {num(c['ef_bl'], 4)} kgCH4/ha/day × {num(area, 4)} ha × {days} days × 10^-3 × {f['gwp_ch4']} "
            f"= {num(c['baseline_tco2e'], 3)} tCO2e",
        ],
        "E.2": [
            "PE = EF_P × A × L × 10^-3 × GWP_CH4, with EF_P = EF_c × SF_w,P × SF_p × SF_o",
            f"EF_P = {f['ef_c']} × {f['sf_w']} × {f['sf_p']} × {f['sf_o']} = {num(c['ef_p'], 4)} kgCH4/ha/day",
            f"PE = {num(c['ef_p'], 4)} kgCH4/ha/day × {num(area, 4)} ha × {days} days × 10^-3 × {f['gwp_ch4']} "
            f"= {num(c['project_tco2e'], 3)} tCO2e",
            "Note: the N2O adjustment for AWD fields (parameters AWD.4 and AWD.5) is not yet included, because data on "
            "nitrogen inputs were not collected in this monitoring period. It must be added before verification.",
        ],
        "E.3": ["LE = 0 tCO2e. In accordance with section 3.7.1 of the applied methodology, leakage emissions are "
                "deemed negligible and are not considered."],
        "E.4": [
            f"ER = (BE − PE) × (1 − Ud) = ({num(c['baseline_tco2e'], 3)} − {num(c['project_tco2e'], 3)}) × "
            f"(1 − {f['uncertainty']}) = {num(net, 3)} tCO2e, where Ud = {unc_pct}% is the default uncertainty deduction "
            f"for the simplified approach (methodology section 6.1.2).",
        ],
        "E.5.1": ["Not Applicable – no approved PDD ex ante estimate is available yet. " + TBC],
        "E.6": ["Not Applicable – no approved PDD ex ante estimate is available for comparison."],
        "F": [TBC + " Safeguarding indicators will be reported according to the design-certified monitoring plan."],
        "G": ["Not Applicable – no gender-sensitive or gender-responsive certification is requested."],
        "I.1": [TBC + " The continuous input and grievance mechanism starts after registration."],
        "I.2": [TBC],
        "I.3": ["No legal contest has arisen with the project during the monitoring period."],
        "J": [TBC],
        "K": ["Not Applicable – no additional co-benefits are claimed."],
    }
    # 각 제목 다음에 오는 안내 문단: 첫 '>>' 문단을 내용으로 바꾸고, 나머지 안내 문단은 지움
    KEEP_PREFIX = ("A.4.1", "G.1.", "G.2.", "H.1.1", "Select to confirm", "Select to acknowledge")
    current = None
    written = set()
    for kind, obj in list(body_items(doc)):
        if kind == "t":
            continue
        p = obj
        style = p.style.name
        text = p.text.strip()
        if style.startswith("Heading"):
            if style in ("Heading 1", "Heading 2"):
                words = text.split()
                head = words[0].rstrip(".")
                if head.upper() == "SECTION" and len(words) > 1:
                    head = words[1].rstrip(".")  # 'SECTION A. …' → 'A'
                current = head
            continue
        if style.startswith("toc") or not text or current is None:
            continue
        if text.startswith(KEEP_PREFIX):
            continue
        content = sections.get(current)
        if content and current not in written:
            write_lines(p, content)
            written.add(current)
            continue
        if current == "L":
            continue  # 이중 발행 확인 체크 문구는 양식 그대로 (사업자가 직접 확인·체크)
        # 이미 채운 섹션의 남은 안내문, 또는 표만 있는 섹션(KEY, A.2, A.4, D.1, D.2, E.5, H…)의 안내문
        remove(p._p)

    # 7) A.2 위치, A.4 인증 기간
    loc = t[T_LOC].rows
    write_cell(uniq_cells(loc[0])[1], "Republic of Korea")
    write_cell(uniq_cells(loc[1])[1], region)
    write_cell(uniq_cells(loc[2])[1], [
        f"{addr or '-'} (Korean cadastral address)",
        f"Parcel ID (PNU): {field.get('pnu') or '-'}",
        f"Project area: {num(area, 4)} ha (from the V-WORLD cadastral parcel boundary)",
    ])
    write_cell(uniq_cells(loc[3])[1], f"{dms(field['latitude'], 'N', 'S')}, {dms(field['longitude'], 'E', 'W')}")
    write_cell(uniq_cells(loc[5])[0], "The parcel boundary map (V-WORLD cadastral map) is available in the Nonstop platform "
                                      "and is to be attached here.")
    cred = t[T_CRED].rows
    for cell in uniq_cells(cred[1]):
        write_cell(cell, TBC)
    write_cell(uniq_cells(cred[2])[0], "Not Applicable at this stage – the crediting period will be fixed at design certification.")

    # 8) D.1 고정 파라미터 표 (파라미터마다 표 복사)
    fixed = [
        ("AWD.1", "GWP_CH4", "Global warming potential of CH4", "tCO2e/tCH4", "E.1, E.2", ["Baseline", "Project"],
         str(f["gwp_ch4"]), "Other", "Value prescribed by the applied methodology (IPCC AR5).", ""),
        ("AWD.3", "EF_c", "Baseline emission factor for continuously flooded fields without organic amendments (South Korea)",
         "kgCH4/ha/day", "E.1, E.2", ["Baseline", "Project"], str(f["ef_c"]), "Other",
         "Country-specific default value for South Korea from Table 9 of the applied methodology (IPCC 2019).", ""),
        ("AWD.6", "SF_w (SF_BL,w / SF_P,w)", "Scaling factor for the water regime during the cultivation period", "-",
         "E.1, E.2", ["Baseline", "Project"],
         f"Baseline (continuously flooded): 1.00; project ({REGIME_EN[regime].lower()}): {f['sf_w']}", "Other",
         "IPCC 2019 default values: continuously flooded 1.00, single drainage 0.71, multiple drainage 0.55. "
         "The project value is selected from the monitored water regime (AWD.16).", ""),
        ("AWD.7", "SF_p", "Scaling factor for the pre-season water regime", "-", "E.1, E.2", ["Baseline", "Project"],
         f"{f['sf_p']} ({preseason})", "Other", "IPCC 2019 default values (Vol. 4, Ch. 5.5) for the recorded pre-season water regime (AWD.17).", ""),
        ("AWD.8", "SF_o", "Scaling factor for organic amendment", "-", "E.1, E.2", ["Baseline", "Project"],
         f"{f['sf_o']} ({organic})", "Other",
         "SF_o = (1 + ROA × CFOA)^0.59 with conversion factors from IPCC 2019, Vol. 4, Ch. 5.5, Table 5.14 (AWD.18).", ""),
        ("Ud", "Ud", "Uncertainty deduction for the simplified approach", "%", "E.4", ["Other"], f"{unc_pct}", "Other",
         "Default uncertainty deduction of 15% for the simplified approach (methodology section 6.1.2).", ""),
    ]
    fill_param_tables(t[T_FIX], fixed, monitored=False)

    # 9) D.2 측정 파라미터 표
    wl_method = ("The water level is measured by an ultrasonic distance sensor mounted above a perforated water tube "
                 "installed in the field. Water level = (sensor-to-soil distance) − (measured distance); "
                 "a drainage event is counted when the level reaches -15 cm and re-armed after recovery above -10 cm.")
    monitored = [
        dict(id="AWD.14", name="A", desc="Project area", unit="ha", eq="E.1, E.2", purpose=["Baseline", "Project"],
             value=num(area, 4), source="V-WORLD cadastral parcel boundary (PNU " + (field.get("pnu") or "-") + ")",
             method="Area calculated from the registered parcel boundary (PostGIS ST_Area, geodesic).",
             resp=operator, instrument=None, interval="Once per monitoring period",
             qa="Cross-checked against the cadastral parcel information."),
        dict(id="AWD.15", name="L", desc="Cultivation period of rice", unit="days", eq="E.1, E.2", purpose=["Baseline", "Project"],
             value=f"{days} days ({dmy(start)} – {dmy(end)})", source="Farm records of transplanting and harvest dates",
             method="Number of days from transplanting to harvest, including both dates.",
             resp=operator, instrument=None, interval="Once per monitoring period",
             qa="Cross-checked against farm log books."),
        dict(id="AWD.16", name="Water regime – on-season", desc="Water regime during the cultivation period, determined "
             "from continuous water-level measurements", unit="-", eq="E.2 (selection of SF_w)", purpose=["Project"],
             value=f"{REGIME_EN[regime]} – {len(drains)} drainage event(s); {mrv['sample_count']:,} water-level measurements",
             source="Water-level sensor data stored in the Nonstop platform", method=wl_method, resp=operator,
             instrument=dict(type="Ultrasonic distance sensor (A02YYUW) on an STM32WL LoRaWAN node",
                             accuracy="±(1 cm + 0.3% of the measured distance) (manufacturer specification)",
                             calibration="Zero point set to the soil surface at installation; readings cross-checked "
                                         "with a manual tape measurement at installation and at each field visit.",
                             months="Each cropping season", year="Before transplanting",
                             location=f"In the project field ({dms(field['latitude'], 'N', 'S')}, {dms(field['longitude'], 'E', 'W')})"),
             interval=f"Continuous ({interval} min)" if interval else "Continuous",
             qa="Raw payloads are stored unchanged; communication-loss and abnormal-level alerts are generated "
                "automatically; data availability is reported in B.1."),
        dict(id="AWD.17", name="Water regime – pre-season", desc="Water regime before the cultivation period", unit="-",
             eq="E.1, E.2 (selection of SF_p)", purpose=["Baseline", "Project"], value=preseason,
             source="Information recorded by the farmer / project developer", method="Recorded once per season.",
             resp=operator, instrument=None, interval="Once per monitoring period", qa="Cross-checked against farm log books."),
        dict(id="AWD.18", name="Organic amendment", desc="Type and amount of organic amendment", unit="t/ha",
             eq="E.1, E.2 (calculation of SF_o)", purpose=["Baseline", "Project"], value=organic,
             source="Information recorded by the farmer / project developer", method="Recorded once per season.",
             resp=operator, instrument=None, interval="Once per monitoring period", qa="Cross-checked against purchase records."),
    ]
    fill_param_tables(t[T_MON], monitored, monitored=True)

    # 10) D.3 비교, D.6 PER, 성과 부족
    d3 = uniq_cells(t[T_D3].rows[1])
    for cell, v in zip(d3, ["All parameters in D.2", "See D.2", "Not Applicable – first monitoring period"]):
        write_cell(cell, v)
    for cell in uniq_cells(t[T_PER].rows[1]):
        write_cell(cell, "Not Applicable")
    write_cell(uniq_cells(t[T_SHORT].rows[0])[1], "Not Applicable – no PERs have been issued.")

    # 11) E.4 순 감축 표, E.5 PDD 비교
    r = uniq_cells(t[T_NET].rows[1])
    for cell, v in zip(r[2:], [num(c["baseline_tco2e"], 3), num(c["project_tco2e"], 3), "0.000", num(net, 3)]):
        write_cell(cell, v)
    r = uniq_cells(t[T_NET].rows[2])
    for cell in r[2:]:
        write_cell(cell, "Not Applicable")
    r = uniq_cells(t[T_EXANTE].rows[1])
    write_cell(r[1], TBC)
    write_cell(r[2], f"{num(net, 3)} tCO2e")

    # 12) F~J 표들: 작성 안내 칸 채우기 (체크박스 칸은 그대로). G(젠더) 표는 해당 없음
    T_SAFE, T_G1, T_G2 = T_EXANTE + 1, T_EXANTE + 2, T_EXANTE + 3
    for ti, tb in enumerate(t[T_SAFE:], start=T_SAFE):
        fill = "Not Applicable" if ti in (T_G1, T_G2) else TBC
        for row in tb.rows:
            for cell in uniq_cells(row)[1:]:
                has_box = any(s.find(f"{qn('w:sdtPr')}/{{{W14}}}checkbox") is not None for s in cell._tc.iter(qn("w:sdt")))
                txt = cell.text.strip()
                # 작성 안내 칸만 바꿈 ('No.' 같은 짧은 항목명 칸은 그대로)
                if not has_box and (txt.startswith(">>") or len(txt) > 25):
                    write_cell(cell, fill)

    # 열 때 목차(TOC) 쪽 번호를 새로 고치도록
    settings = doc.settings.element
    if settings.find(qn("w:updateFields")) is None:
        upd = settings.makeelement(qn("w:updateFields"), {qn("w:val"): "true"})
        # 스키마 순서상 updateFields는 hdrShapeDefaults/footnotePr/endnotePr/compat 앞
        after = next((settings.find(qn(f"w:{n}")) for n in ("hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids")
                      if settings.find(qn(f"w:{n}")) is not None), None)
        if after is not None:
            after.addprevious(upd)
        else:
            settings.append(upd)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def fill_param_tables(template_tbl: Table, params: list, monitored: bool):
    """파라미터 표를 파라미터 수만큼 복사해서 채움 (양식: 'Copy the below table for each data or parameter')."""
    blank = copy.deepcopy(template_tbl._tbl)
    anchor = template_tbl._tbl
    for i, prm in enumerate(params):
        if i == 0:
            tbl = template_tbl
        else:
            spacer = anchor.makeelement(qn("w:p"), {})  # 표 사이 빈 줄 (기본 문단)
            new = copy.deepcopy(blank)
            anchor.addnext(spacer)
            spacer.addnext(new)
            anchor = new
            tbl = Table(new, template_tbl._parent)
        rows = tbl.rows
        if not monitored:
            pid, name, desc, unit, eq, purpose, value, source, method, comment = prm
            vals = {0: pid, 1: name, 2: desc, 3: unit, 4: eq, 7: value, 10: method,
                    11: comment or "-"}
            for idx, v in vals.items():
                write_cell(uniq_cells(rows[idx])[1], v)
            for label in purpose:
                check(rows[5]._tr, label)
            write_cell(uniq_cells(rows[6])[1], "See the ticked options above.")
            check(rows[8]._tr, "Other sources" if source == "Other" else "Measured")
            write_cell(uniq_cells(rows[9])[1], "Default values from the applied methodology and IPCC 2019 guidelines.")
        else:
            p = prm
            vals = {0: p["id"], 1: p["name"], 2: p["desc"], 3: p["unit"], 4: p["eq"], 7: p["value"], 8: p["source"],
                    9: p["method"], 10: p["resp"], 19: p["interval"], 20: p["qa"], 21: "-"}
            for idx, v in vals.items():
                write_cell(uniq_cells(rows[idx])[1], v)
            for label in p["purpose"]:
                check(rows[5]._tr, label)
            write_cell(uniq_cells(rows[6])[1], "See the ticked options above.")
            ins = p["instrument"]
            if ins:
                check(rows[11]._tr, "Applicable")
                write_cell(uniq_cells(rows[12])[2], ins["type"])
                write_cell(uniq_cells(rows[13])[2], ins["accuracy"])
                write_cell(uniq_cells(rows[14])[2], ins["calibration"])
                check(rows[15]._tr, "Required")
                write_cell(uniq_cells(rows[16])[3], ins["months"])
                write_cell(uniq_cells(rows[16])[4], ins["year"])
                write_cell(uniq_cells(rows[18])[2], ins["location"])
            else:
                check(rows[11]._tr, "Not applicable")
                for idx in (12, 13, 14, 18):
                    write_cell(uniq_cells(rows[idx])[2], "Not Applicable")
                for cell in uniq_cells(rows[16])[3:]:
                    write_cell(cell, "-")
                check(rows[17]._tr, "Not required")
