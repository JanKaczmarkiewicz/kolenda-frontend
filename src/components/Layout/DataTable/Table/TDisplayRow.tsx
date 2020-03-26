import React from "react";
import { TableRow, TableCell } from "@material-ui/core";

interface Props {
  data: any;
  renderOptions?: () => JSX.Element;
}

function TDisplayRow({ data, renderOptions }: Props) {
  return (
    <TableRow>
      {Object.keys(data).map(key => (
        <TableCell>{data[key]}</TableCell>
      ))}
      {renderOptions && renderOptions()}
    </TableRow>
  );
}

export default TDisplayRow;
