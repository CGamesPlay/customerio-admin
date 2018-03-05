import fetch from "isomorphic-fetch";
import _ from "lodash";

import { bearerToken, environmentId } from "./credentials";

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

const apiRequest = (url, options = {}) => {
  console.log(
    `${options.method || "GET"} ${url}${options.body
      ? "\n" + options.body
      : ""}`,
  );
  return fetch(
    `https://fly.customer.io/v1/environments/${environmentId}${url}`,
    _.merge(
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      options,
    ),
  ).then(
    response =>
      response.status === 204
        ? null
        : response.json().then(obj => {
            console.log("=>", obj);
            if (response.ok) {
              return Promise.resolve(obj);
            } else {
              return Promise.reject(obj);
            }
          }),
  );
};

const getCampaign = campaignId => apiRequest(`/campaigns/${campaignId}`);
const getTemplate = templateId => apiRequest(`/templates/${templateId}`);
const getSegments = () => apiRequest("/segments");
const getSegmentUsage = segmentId => apiRequest(`/segments/${segmentId}/usage`);

const deleteAction = actionId =>
  apiRequest(`/actions/${actionId}`, { method: "DELETE" });

const deleteSegment = segmentId =>
  apiRequest(`/segments/${segmentId}`, { method: "DELETE" });

const createAction = (campaignId, props) =>
  apiRequest(`/campaigns/${campaignId}/actions`, {
    method: "POST",
    body: JSON.stringify(props),
  });

/// Takes an email action identified by baseActionId and converts it into a
/// split_randomized action with the same ID. This will create 2 new actions
/// with new IDs referenced in the converted action's action_ids.
const createTest = (campaignId, baseActionId) =>
  apiRequest(`/actions/${baseActionId}/test`, {
    method: "POST",
    body: JSON.stringify({
      campaign_id: campaignId.toString(),
      type: "randomized",
    }),
  });

const cloneTemplate = (oldTemplate, newTemplateId) =>
  apiRequest(`/templates/${newTemplateId}`, {
    method: "PUT",
    body: JSON.stringify({
      template: _.pick(oldTemplate, [
        "subject",
        "name",
        "body",
        "recipient",
        "editor",
        "bcc",
        "fake_bcc",
        "template_type",
        "created",
        "updated",
        "preprocessor",
        "layout_id",
        "from_identity_id",
        "reply_to_identity_id",
      ]),
    }),
  });

const cloneEmailActionProperties = (oldAction, newActionId) =>
  apiRequest(`/actions/${newActionId}`, {
    method: "PUT",
    body: JSON.stringify({
      action: _.pick(oldAction, [
        "type",
        "updated",
        "action_state",
        "preconditions",
        "delay",
        "start_time",
        "end_time",
        "days",
        "zone",
        "name",
        "sending_state",
        "tracked",
        "send_to_unsubscribed",
        "has_url",
        "split_state",
        "started",
        "attribute_name",
        "attribute_value",
        "has_content",
      ]),
    }),
  });

const cloneSplitActionProperties = (oldAction, newActionId) =>
  apiRequest(`/actions/${newActionId}`, {
    method: "PUT",
    body: JSON.stringify({
      action: _.pick(oldAction, [
        "type",
        "updated",
        "action_state",
        "preconditions",
        "delay",
        "start_time",
        "end_time",
        "days",
        "zone",
        "name",
        "sending_state",
        "tracked",
        "send_to_unsubscribed",
        "request_method",
        "hostname",
        "has_url",
        "allocations",
        "split_state",
        "started",
        "attribute_name",
        "attribute_value",
        "has_content",
        "tracked_link_metric_id",
      ]),
    }),
  });

const cloneEmailAction = (
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) => {
  const request = {
    action: { type: "email_action" },
    index,
    workflow_action_ids,
  };
  return createAction(newCampaignId, request).then(response => {
    const newAction = _.find(response.actions, { id: response.meta.action_id });
    return getTemplate(oldAction.template_id)
      .then(template => cloneTemplate(template.template, newAction.template_id))
      .then(() => cloneEmailActionProperties(oldAction, newAction.id))
      .then(() => newAction.id);
  });
};

const cloneSplitAction = (
  actions,
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) => {
  // Create an email then initiate a test
  const request = {
    action: { type: "email_action" },
    index,
    workflow_action_ids,
  };
  return createAction(newCampaignId, request)
    .then(response => response.meta.action_id)
    .then(newActionId => {
      return createTest(newCampaignId, newActionId)
        .then(response => {
          let testAction = _.find(response.actions, { id: newActionId });
          return oldAction.action_ids
            .map((oldVariantId, idx) => {
              let oldVariant = _.find(actions, { id: oldVariantId });
              let newVariant = _.find(response.actions, {
                id: testAction.action_ids[idx],
              });
              return () =>
                getTemplate(oldVariant.template_id)
                  .then(template =>
                    cloneTemplate(template.template, newVariant.template_id),
                  )
                  .then(() =>
                    cloneEmailActionProperties(oldVariant, newVariant.id),
                  );
            })
            .reduce((p, t) => p.then(t), Promise.resolve(null));
        })
        .then(() => cloneSplitActionProperties(oldAction, newActionId))
        .then(() => newActionId);
    });
};

const cloneDelayAction = (
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) =>
  createAction(newCampaignId, {
    index,
    workflow_action_ids,
    action: _.pick(oldAction, [
      "type",
      "updated",
      "action_state",
      "preconditions",
      "delay",
      "start_time",
      "end_time",
      "days",
      "zone",
      "name",
      "sending_state",
      "tracked",
      "send_to_unsubscribed",
      "request_method",
      "has_url",
      "split_state",
      "started",
      "attribute_name",
      "attribute_value",
      "has_content",
    ]),
  }).then(response => response.meta.action_id);

const cloneAttributeUpdateAction = (
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) =>
  createAction(newCampaignId, {
    index,
    workflow_action_ids,
    action: _.pick(oldAction, [
      "action_state",
      "attribute_name",
      "attribute_value",
      "created",
      "has_content",
      "name",
      "preconditions",
      "sending_state",
      "subject_count",
      "type",
      "updated",
    ]),
  }).then(response => response.meta.action_id);

const cloneFilterMatchDelayAction = (
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) =>
  createAction(newCampaignId, {
    index,
    workflow_action_ids,
    action: _.pick(oldAction, [
      "action_state",
      "created",
      "preconditions",
      "type",
      "updated",
    ]),
  }).then(response => response.meta.action_id);

const cloneAction = (
  actions,
  oldAction,
  index,
  workflow_action_ids,
  newCampaignId,
) => {
  switch (oldAction.type) {
    case "email_action":
      return cloneEmailAction(
        oldAction,
        index,
        workflow_action_ids,
        newCampaignId,
      );
    case "split_randomized_action":
      return cloneSplitAction(
        actions,
        oldAction,
        index,
        workflow_action_ids,
        newCampaignId,
      );
    case "delay_seconds_action":
    case "delay_time_window_action":
      return cloneDelayAction(
        oldAction,
        index,
        workflow_action_ids,
        newCampaignId,
      );
    case "attribute_update_action":
      return cloneAttributeUpdateAction(
        oldAction,
        index,
        workflow_action_ids,
        newCampaignId,
      );
    case "filter_match_delay_action":
      // Customer.io treats this as a special action and their server breaks if
      // you modify the built-in one. It isn't shown in the UI at all.
      return Promise.resolve(null);
    default:
      return Promise.reject(
        new Error(`Unable to clone action type ${oldAction.type}`),
      );
  }
};

const deleteAllWorkflowActions = campaignResult =>
  campaignResult.actions
    .filter(a => a.type !== "filter_match_delay_action")
    .map(a => () => deleteAction(a.id))
    .reduce((p, t) => p.then(t), Promise.resolve(null))
    .then(() =>
      campaignResult.campaign.workflow_action_ids.filter(id =>
        _.find(campaignResult.actions, {
          id,
          type: "filter_match_delay_action",
        }),
      ),
    );

// Clone a campaign's workflow actions into another campaign. To use, create a
// new campaign with the desired trigger, filter, and goal. Pass in the source
// and destination campaign IDs.
//
// If newCampaignId has any workflow items in it, they will be deleted.
export const cloneCampaignWorkflowActions = (oldCampaignId, newCampaignId) =>
  getCampaign(oldCampaignId).then(({ campaign, actions }) =>
    getCampaign(newCampaignId)
      .then(result => deleteAllWorkflowActions(result))
      .then(remainingActionIds =>
        campaign.workflow_action_ids
          .map((id, idx) => workflow_action_ids =>
            cloneAction(
              actions,
              _.find(actions, { id }),
              idx,
              workflow_action_ids,
              newCampaignId,
            ).then(newActionId =>
              workflow_action_ids.concat(newActionId ? [newActionId] : []),
            ),
          )
          .reduce((p, t) => p.then(t), Promise.resolve(remainingActionIds)),
      ),
  );

// Enumerate all segments and delete them if they aren't referenced from any
// campaigns or newsletters.
export const deleteUnusedSegments = () =>
  getSegments().then(response =>
    response.segments
      .map(seg => () =>
        getSegmentUsage(seg.id).then(usage => {
          let count = _.sum(Reflect.ownKeys(usage).map(k => usage[k].length));
          if (count === 0 && seg.updated_at < 1498892400) {
            console.log("Delete", seg.name, usage);
            return deleteSegment(seg.id);
          } else {
            console.log("Keep", seg.name, count);
            return Promise.resolve(null);
          }
        }),
      )
      .reduce((p, t) => p.then(t), Promise.resolve(null)),
  );
