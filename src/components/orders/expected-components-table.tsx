import { ComponentThumb } from "@/components/component-thumb";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { ExpectedComponentDTO } from "@/lib/dto";
import { formatInteger } from "@/lib/format";

/** Output of the multiplier engine: target quantity × pieces per garment, per component. */
export function ExpectedComponentsTable({
  components,
  targetQty,
  caption = "Expected component counts",
}: {
  components: Array<Pick<ExpectedComponentDTO, "id" | "componentName" | "piecesPerGarment" | "imageUrl" | "expectedQty">>;
  targetQty: number;
  caption?: string;
}) {
  const totalPieces = components.reduce((sum, component) => sum + component.expectedQty, 0);
  return (
    <TableContainer label={caption} className="rounded-lg border border-slate-200">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <THead>
          <tr>
            <Th>Component</Th>
            <Th className="text-right">Per garment</Th>
            <Th className="text-right">Expected</Th>
          </tr>
        </THead>
        <TBody>
          {components.map((component) => (
            <Tr key={component.id}>
              <Td>
                <span className="flex items-center gap-3">
                  <ComponentThumb imageUrl={component.imageUrl} size="sm" />
                  <span className="font-medium whitespace-nowrap text-slate-900">{component.componentName}</span>
                </span>
              </Td>
              <Td className="tabular text-right whitespace-nowrap text-slate-700">
                {component.piecesPerGarment} <span className="text-slate-500">× {formatInteger(targetQty)}</span>
              </Td>
              <Td className="tabular text-right text-base font-bold text-slate-900">{formatInteger(component.expectedQty)}</Td>
            </Tr>
          ))}
        </TBody>
        <tfoot className="border-t border-slate-300 bg-slate-50">
          <tr>
            <Td className="font-semibold text-slate-900">Total cut pieces</Td>
            <Td />
            <Td className="tabular text-right text-base font-bold text-slate-900">{formatInteger(totalPieces)}</Td>
          </tr>
        </tfoot>
      </Table>
    </TableContainer>
  );
}
