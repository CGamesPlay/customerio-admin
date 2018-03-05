import * as api from "./api";

api.cloneCampaignWorkflowActions("1000107", "1000116").then(
  () => console.log("Done!"),
  err => {
    if (err instanceof Error) {
      console.error(err.stack);
    } else {
      console.error(err);
    }
    process.exit(1);
  },
);
