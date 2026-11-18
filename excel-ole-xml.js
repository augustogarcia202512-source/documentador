function anchorXml(column, row) {
  return `<from><xdr:col>${column}</xdr:col><xdr:colOff>31750</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>31750</xdr:rowOff></from><to><xdr:col>${column}</xdr:col><xdr:colOff>955675</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>869950</xdr:rowOff></to>`;
}

function position(ole, widths) {
  return {
    left: widths.slice(0, ole.column).reduce((sum, width) => sum + width, 0) * 5.25 + 2.5,
    top: 24 + (ole.row - 1) * 76 + 2.5,
  };
}

function drawingAnchor(ole, widths) {
  const shapeId = 2049 + ole.index;
  const { left, top } = position(ole, widths);
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14"><xdr:twoCellAnchor><xdr:from><xdr:col>${ole.column}</xdr:col><xdr:colOff>31750</xdr:colOff><xdr:row>${ole.row}</xdr:row><xdr:rowOff>31750</xdr:rowOff></xdr:from><xdr:to><xdr:col>${ole.column}</xdr:col><xdr:colOff>955675</xdr:colOff><xdr:row>${ole.row}</xdr:row><xdr:rowOff>869950</xdr:rowOff></xdr:to><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="${shapeId}" name="Object ${ole.index + 1}" hidden="1"><a:extLst><a:ext uri="{63B3BB69-23CF-44E3-9099-C40C66FF867C}"><a14:compatExt spid="_x0000_s${shapeId}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="${Math.round(left * 12700)}" y="${Math.round(top * 12700)}"/><a:ext cx="923925" cy="838200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor></mc:Choice><mc:Fallback/></mc:AlternateContent>`;
}

function objectXml(ole, imageRelationshipId) {
  const shapeId = 2049 + ole.index;
  const relationshipId = `rId${ole.index + 3}`;
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x14"><oleObject shapeId="${shapeId}" progId="Package" r:id="${relationshipId}" dvAspect="DVASPECT_ICON"><objectPr defaultSize="0" r:id="${imageRelationshipId}"><anchor moveWithCells="1" sizeWithCells="1">${anchorXml(ole.column, ole.row)}</anchor></objectPr></oleObject></mc:Choice><mc:Fallback><oleObject shapeId="${shapeId}" progId="Package" r:id="${relationshipId}" dvAspect="DVASPECT_ICON"/></mc:Fallback></mc:AlternateContent>`;
}

function vmlShape(ole, widths) {
  const shapeId = 2049 + ole.index;
  const { left, top } = position(ole, widths);
  return `<v:shape id="_x0000_s${shapeId}" o:spt="75" type="#_x0000_t75" style="position:absolute;left:${left}pt;top:${top}pt;height:66pt;width:72.75pt;" o:ole="t" fillcolor="window [65]" filled="t" o:preferrelative="t" stroked="t" coordsize="21600,21600"><v:path/><v:fill on="t" color2="window [65]" focussize="0,0"/><v:stroke color="windowText [64]" miterlimit="8" joinstyle="miter"/><v:imagedata o:relid="rId1" o:title=""/><o:lock v:ext="edit" aspectratio="t"/><x:ClientData ObjectType="Pict"><x:Anchor>${ole.column},3,${ole.row},3,${ole.column},100,${ole.row},91</x:Anchor><x:MoveWithCells/><x:SizeWithCells/></x:ClientData></v:shape>`;
}

export function createOleXml(objects, widths) {
  const imageRelationshipId = `rId${objects.length + 3}`;
  const objectsXml = objects.map((ole) => objectXml(ole, imageRelationshipId)).join("");
  const relationships = objects.map((ole) =>
    `<Relationship Id="rId${ole.index + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="../embeddings/oleObject${ole.index + 1}.bin"/>`
  ).join("");
  const drawing = objects.map((ole) => drawingAnchor(ole, widths)).join("");
  const vml = `<xml xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="2"/></o:shapelayout><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:formulas><v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/><v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/><v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/></v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype>${objects.map((ole) => vmlShape(ole, widths)).join("")}</xml>`;
  return { objectsXml, relationships, imageRelationshipId, drawing, vml };
}
