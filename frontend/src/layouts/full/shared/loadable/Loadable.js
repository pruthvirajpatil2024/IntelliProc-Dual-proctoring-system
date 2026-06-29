import React, { Suspense } from "react";
import LinearProgress from "@mui/material/LinearProgress";

const Loadable = (Component) => (props) => (
  <Suspense fallback={<LinearProgress />}>
    <Component {...props} />
  </Suspense>
);

export default Loadable;
