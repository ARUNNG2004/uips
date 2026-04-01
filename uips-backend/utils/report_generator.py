import os
from database.db import db
from models.session import ExamSession
from models.user import User
from models.exam import Exam
from models.event import SuspicionEvent

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _load_session_bundle(session_id: int):
        session = ExamSession.query.get(session_id)
        if not session:
                raise ValueError("Session not found")

        student = User.query.get(session.student_id)
        exam = Exam.query.get(session.exam_id)
        events = (
                SuspicionEvent.query.filter_by(session_id=session_id)
                .order_by(SuspicionEvent.timestamp.asc())
                .all()
        )

        if not student or not exam:
                raise ValueError("Missing student or exam data")

        return session, student, exam, events


def _build_html_report(session, student, exam, events) -> str:
        total_events = len(events)
        final_score = session.suspicion_index
        risk_level = "High" if final_score > 70 else "Medium" if final_score >= 30 else "Low"

        score_color = "#ef4444" if final_score > 70 else "#f59e0b" if final_score >= 30 else "#10b981"

        if not events:
                event_rows = """
                    <tr>
                        <td colspan=\"4\" class=\"empty\">No suspicious events recorded during this session.</td>
                    </tr>
                """
        else:
                rows = []
                for e in events:
                        ts = e.timestamp.strftime("%Y-%m-%d %H:%M:%S") if e.timestamp else "N/A"
                        etype = e.event_type.value if hasattr(e.event_type, "value") else e.event_type
                        sev = e.severity.value if hasattr(e.severity, "value") else e.severity
                        score = e.score_delta
                        rows.append(
                                f"<tr><td>{ts}</td><td>{etype}</td><td>{sev}</td><td>{score:.2f}</td></tr>"
                        )
                event_rows = "".join(rows)

        return f"""
<!doctype html>
<html>
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Exam Report - {student.name}</title>
    <style>
        :root {{
            --bg: #081126;
            --panel: #101b34;
            --panel-2: #162447;
            --text: #e2e8f0;
            --muted: #94a3b8;
            --line: #243a66;
            --primary: #3b82f6;
            --risk: {score_color};
        }}
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            font-family: Segoe UI, Arial, sans-serif;
            background: radial-gradient(circle at top right, #14254a, var(--bg) 45%);
            color: var(--text);
            padding: 24px;
        }}
        .report {{
            max-width: 980px;
            margin: 0 auto;
            background: linear-gradient(180deg, rgba(22,36,71,.95), rgba(16,27,52,.95));
            border: 1px solid var(--line);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 18px 40px rgba(0,0,0,.35);
        }}
        .header {{
            padding: 24px;
            border-bottom: 1px solid var(--line);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }}
        .title h1 {{ margin: 0; font-size: 30px; letter-spacing: .4px; }}
        .title p {{ margin: 8px 0 0; color: var(--muted); }}
        .chip {{
            border: 1px solid var(--risk);
            color: var(--risk);
            background: rgba(0,0,0,.15);
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: .6px;
            text-transform: uppercase;
        }}
        .toolbar {{
            display: flex;
            gap: 10px;
            margin-top: 14px;
        }}
        .btn {{
            border: 1px solid var(--line);
            background: var(--panel-2);
            color: var(--text);
            border-radius: 8px;
            padding: 9px 14px;
            cursor: pointer;
            font-weight: 600;
        }}
        .btn:hover {{ border-color: var(--primary); }}
        .content {{ padding: 24px; }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }}
        .stat {{
            background: rgba(0,0,0,.18);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 14px;
        }}
        .stat .k {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .8px; }}
        .stat .v {{ margin-top: 8px; font-size: 24px; font-weight: 700; }}
        .stat .v.risk {{ color: var(--risk); }}
        .section-title {{ margin: 26px 0 12px; font-size: 20px; }}
        table {{ width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 10px; }}
        thead th {{
            text-align: left;
            font-size: 12px;
            color: var(--muted);
            padding: 12px;
            background: rgba(0,0,0,.16);
            border-bottom: 1px solid var(--line);
            text-transform: uppercase;
            letter-spacing: .9px;
        }}
        tbody td {{ padding: 12px; border-bottom: 1px solid var(--line); font-size: 14px; }}
        tbody tr:hover {{ background: rgba(59,130,246,.08); }}
        .empty {{ color: var(--muted); text-align: center; padding: 20px !important; }}
        .footer {{
            margin-top: 20px;
            color: var(--muted);
            border-top: 1px solid var(--line);
            padding-top: 14px;
            font-size: 12px;
        }}
        @media (max-width: 900px) {{
            .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
        }}
        @media print {{
            body {{ background: #fff; color: #111; padding: 0; }}
            .report {{ box-shadow: none; border: none; }}
            .toolbar {{ display: none; }}
            .stat, thead th, tbody td, .header {{ border-color: #d1d5db !important; }}
        }}
    </style>
</head>
<body>
    <div class=\"report\">
        <div class=\"header\">
            <div class=\"title\">
                <h1>Exam Report</h1>
                <p><strong>Exam:</strong> {exam.title} | <strong>Student:</strong> {student.name}</p>
                <div class=\"toolbar\">
                    <button class=\"btn\" onclick=\"window.print()\">Download as PDF</button>
                </div>
            </div>
            <div class=\"chip\">{risk_level} Risk</div>
        </div>

        <div class=\"content\">
            <div class=\"grid\">
                <div class=\"stat\"><div class=\"k\">Session ID</div><div class=\"v\">#{session.id}</div></div>
                <div class=\"stat\"><div class=\"k\">Total Events</div><div class=\"v\">{total_events}</div></div>
                <div class=\"stat\"><div class=\"k\">Final Score</div><div class=\"v\">{final_score:.1f}</div></div>
                <div class=\"stat\"><div class=\"k\">Risk Level</div><div class=\"v risk\">{risk_level}</div></div>
            </div>

            <h2 class=\"section-title\">Events</h2>
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Event Type</th>
                        <th>Severity</th>
                        <th>Score Delta</th>
                    </tr>
                </thead>
                <tbody>
                    {event_rows}
                </tbody>
            </table>

            <div class=\"footer\">Generated by UIPS System</div>
        </div>
    </div>
</body>
</html>
"""


def generate_report_pdf(session_id: int) -> str:
        session, student, exam, events = _load_session_bundle(session_id)

        final_score = session.suspicion_index
        risk_level = "High" if final_score > 70 else "Medium" if final_score >= 30 else "Low"

        pdf_dir = f"reports/{exam.id}"
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = f"{pdf_dir}/report_{student.id}.pdf"

        c = canvas.Canvas(pdf_path, pagesize=A4)
        width, height = A4
        y = height - 25 * mm

        c.setFillColor(colors.HexColor("#0b1a37"))
        c.rect(0, height - 35 * mm, width, 35 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(20 * mm, y, "UIPS Exam Report")
        c.setFont("Helvetica", 11)
        c.drawString(20 * mm, y - 7 * mm, f"Exam: {exam.title}")
        c.drawString(20 * mm, y - 13 * mm, f"Student: {student.name}")

        y = height - 50 * mm
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(20 * mm, y, "Summary")
        y -= 8 * mm

        c.setFont("Helvetica", 11)
        c.drawString(20 * mm, y, f"Session ID: {session.id}")
        y -= 6 * mm
        c.drawString(20 * mm, y, f"Total Events: {len(events)}")
        y -= 6 * mm
        c.drawString(20 * mm, y, f"Final Score: {final_score:.1f}")
        y -= 6 * mm
        c.drawString(20 * mm, y, f"Risk Level: {risk_level}")
        y -= 12 * mm

        c.setFont("Helvetica-Bold", 12)
        c.drawString(20 * mm, y, "Events")
        y -= 8 * mm

        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, y, "Timestamp")
        c.drawString(70 * mm, y, "Type")
        c.drawString(125 * mm, y, "Severity")
        c.drawString(160 * mm, y, "Delta")
        y -= 4 * mm
        c.line(20 * mm, y, 190 * mm, y)
        y -= 5 * mm

        c.setFont("Helvetica", 9)
        if not events:
                c.drawString(20 * mm, y, "No suspicious events recorded during this session.")
        else:
                for e in events:
                        if y < 20 * mm:
                                c.showPage()
                                y = height - 20 * mm
                                c.setFont("Helvetica", 9)

                        ts = e.timestamp.strftime("%Y-%m-%d %H:%M:%S") if e.timestamp else "N/A"
                        etype = e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type)
                        sev = e.severity.value if hasattr(e.severity, "value") else str(e.severity)
                        delta = f"{e.score_delta:.2f}"

                        c.drawString(20 * mm, y, ts[:24])
                        c.drawString(70 * mm, y, etype[:28])
                        c.drawString(125 * mm, y, sev)
                        c.drawRightString(185 * mm, y, delta)
                        y -= 5 * mm

        c.save()
        return pdf_path

def generate_report(session_id: int) -> str:
    """Generate an HTML report for an exam session.
    Save to reports/<exam_id>/report_<student_id>.html
    """
    session, student, exam, events = _load_session_bundle(session_id)

    dir_path = f"reports/{exam.id}"
    os.makedirs(dir_path, exist_ok=True)
    file_path = f"{dir_path}/report_{student.id}.html"

    html_content = _build_html_report(session, student, exam, events)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    return file_path
