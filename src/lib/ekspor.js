// Ekspor laporan ke Excel (.xlsx) dan PDF.
// Bentuk data laporan (dipakai keduanya):
//   { judul, subjudul?: string[], kolom: [{ label, tipe?: 'teks'|'angka'|'uang', lebar? }], baris: any[][], total?: any[] }
// buatXlsx() murni (tanpa DOM) sehingga dapat diuji di Node; unduh*() memakai browser.
import { strToU8, zipSync } from 'fflate'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
const namaKolom = (i) => { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }
const namaSheet = (s, dipakai) => {
  let n = String(s || 'Laporan').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Laporan'
  let i = 2
  while (dipakai.has(n.toLowerCase())) n = `${n.slice(0, 28)} ${i++}`
  dipakai.add(n.toLowerCase())
  return n
}

// Gaya: 0 biasa, 1 judul tebal besar, 2 subjudul, 3 header, 4 angka, 5 total teks, 6 total angka
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F2EF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function sel(ref, nilai, numerik, gaya) {
  if (nilai === null || nilai === undefined || nilai === '') return `<c r="${ref}" s="${gaya}"/>`
  if (numerik && Number.isFinite(Number(nilai))) return `<c r="${ref}" s="${gaya}"><v>${Number(nilai)}</v></c>`
  return `<c r="${ref}" s="${gaya}" t="inlineStr"><is><t xml:space="preserve">${esc(nilai)}</t></is></c>`
}

function sheetXml(lap) {
  const n = Math.max(lap.kolom.length, 1)
  const rows = []
  let r = 1
  const baris = (cells) => rows.push(`<row r="${r}">${cells.join('')}</row>`)
  const merge = []
  baris([sel(`A${r}`, lap.judul, false, 1)]); merge.push(`A${r}:${namaKolom(n - 1)}${r}`); r++
  for (const s of lap.subjudul || []) { baris([sel(`A${r}`, s, false, 2)]); merge.push(`A${r}:${namaKolom(n - 1)}${r}`); r++ }
  r++ // baris kosong
  const header = r
  baris(lap.kolom.map((k, i) => sel(`${namaKolom(i)}${r}`, k.label, false, 3))); r++
  for (const b of lap.baris) {
    baris(lap.kolom.map((k, i) => {
      const num = k.tipe === 'uang' || k.tipe === 'angka'
      return sel(`${namaKolom(i)}${r}`, b[i], num, num ? 4 : 0)
    }))
    r++
  }
  if (lap.total) {
    baris(lap.kolom.map((k, i) => {
      const num = k.tipe === 'uang' || k.tipe === 'angka'
      return sel(`${namaKolom(i)}${r}`, lap.total[i], num, num ? 6 : 5)
    }))
    r++
  }
  const cols = lap.kolom.map((k, i) => {
    const isi = [k.label, ...lap.baris.map((b) => b[i])].map((v) => String(v ?? '').length)
    const w = k.lebar || Math.min(60, Math.max(8, ...isi) + 2)
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols.join('')}</cols><sheetData>${rows.join('')}</sheetData>
<mergeCells count="${merge.length}">${merge.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

/** Bangun berkas .xlsx (Uint8Array) dari satu atau beberapa laporan; tiap laporan menjadi satu sheet. */
export function buatXlsx(laporan) {
  const list = Array.isArray(laporan) ? laporan : [laporan]
  const dipakai = new Set()
  const nama = list.map((l) => namaSheet(l.sheet || l.judul, dipakai))
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nama.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
  }
  list.forEach((l, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(l) })
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 })
}

export const namaBerkas = (s) => String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'laporan'

function unduh(blob, nama) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: nama })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function unduhExcel(nama, laporan) {
  unduh(new Blob([buatXlsx(laporan)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${namaBerkas(nama)}.xlsx`)
}

const fmtSel = (v, tipe) => (tipe === 'uang' || tipe === 'angka') && v !== '' && v != null && Number.isFinite(Number(v))
  ? (Math.round(Number(v)) || 0).toLocaleString('id-ID') : String(v ?? '')

/** PDF A4 lanskap dengan kop, tabel, dan catatan simulasi. Pustaka dimuat saat dibutuhkan. */
export async function unduhPDF(nama, laporan, { tandaTangan } = {}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const list = Array.isArray(laporan) ? laporan : [laporan]
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const lebar = pdf.internal.pageSize.getWidth()
  list.forEach((lap, idx) => {
    if (idx) pdf.addPage()
    let y = 14
    pdf.setFont('helvetica', 'bold').setFontSize(12).text(String(lap.judul).toUpperCase(), lebar / 2, y, { align: 'center' })
    pdf.setFont('helvetica', 'normal').setFontSize(9)
    for (const s of lap.subjudul || []) { y += 5; pdf.text(String(s), lebar / 2, y, { align: 'center' }) }
    const kanan = lap.kolom.map((k) => k.tipe === 'uang' || k.tipe === 'angka')
    autoTable(pdf, {
      startY: y + 5,
      head: [lap.kolom.map((k) => k.label)],
      body: lap.baris.map((b) => lap.kolom.map((k, i) => fmtSel(b[i], k.tipe))),
      foot: lap.total ? [lap.kolom.map((k, i) => fmtSel(lap.total[i], k.tipe))] : undefined,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [30, 41, 59] },
      headStyles: { fillColor: [226, 242, 239], textColor: [15, 23, 42], fontStyle: 'bold' },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: Object.fromEntries(kanan.map((r, i) => [i, r ? { halign: 'right' } : {}]).filter(([, v]) => v.halign)),
      showFoot: 'lastPage',
      margin: { left: 12, right: 12, bottom: 14 },
    })
    if (tandaTangan) {
      let ty = pdf.lastAutoTable.finalY + 14
      if (ty > pdf.internal.pageSize.getHeight() - 30) { pdf.addPage(); ty = 20 }
      pdf.setFontSize(9)
      tandaTangan.forEach((t, i) => {
        const x = (lebar / (tandaTangan.length + 1)) * (i + 1)
        pdf.text(t, x, ty, { align: 'center' })
        pdf.text('(..............................)', x, ty + 20, { align: 'center' })
      })
    }
  })
  const n = pdf.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7).setTextColor(120)
    pdf.text('SIMANTAP — Aplikasi Simulasi Pembelajaran, bukan dokumen resmi.', 12, pdf.internal.pageSize.getHeight() - 7)
    pdf.text(`Halaman ${i} dari ${n}`, lebar - 12, pdf.internal.pageSize.getHeight() - 7, { align: 'right' })
  }
  pdf.save(`${namaBerkas(nama)}.pdf`)
}
