import React, { ReactChildren } from "react";
import PropTypes from "prop-types";

import Typography from "@material-ui/core/Typography";

export default function Title({
  children
}: {
  children: string | ReactChildren;
}) {
  return (
    <Typography
      component="h2"
      variant="h5"
      color="primary"
      gutterBottom
      style={{ flex: "1 1 100%" }}
    >
      {children}
    </Typography>
  );
}

Title.propTypes = {
  children: PropTypes.node
};
