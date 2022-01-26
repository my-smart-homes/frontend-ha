import "@polymer/paper-item/paper-icon-item";
import "@polymer/paper-item/paper-item";
import "@polymer/paper-item/paper-item-body";
import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators";
import { computeDomain } from "../../../../common/entity/compute_domain";
import { domainIcon } from "../../../../common/entity/domain_icon";
import "../../../../components/entity/state-badge";
import "../../../../components/ha-card";
import "../../../../components/ha-icon";
import type { LovelaceRowConfig } from "../../../lovelace/entity-rows/types";
import type { HomeAssistant } from "../../../../types";
import type { HuiErrorCard } from "../../../lovelace/cards/hui-error-card";
import { createRowElement } from "../../../lovelace/create-element/create-row-element";
import { addEntitiesToLovelaceView } from "../../../lovelace/editor/add-entities-to-view";
import { LovelaceRow } from "../../../lovelace/entity-rows/types";
import { showEntityEditorDialog } from "../../entities/show-dialog-entity-editor";
import { EntityRegistryStateEntry } from "../ha-config-device-page";
import { computeStateName } from "../../../../common/entity/compute_state_name";
import { stripPrefixFromEntityName } from "../../../../common/entity/strip_prefix_from_entity_name";
import {
  ExtEntityRegistryEntry,
  getExtendedEntityRegistryEntry,
} from "../../../../data/entity_registry";

@customElement("ha-device-entities-card")
export class HaDeviceEntitiesCard extends LitElement {
  @property() public header!: string;

  @property() public deviceName!: string;

  @property({ attribute: false }) public hass!: HomeAssistant;

  @property() public entities!: EntityRegistryStateEntry[];

  @property() public showDisabled = false;

  @state() private _extDisabledEntityEntries?: Record<
    string,
    ExtEntityRegistryEntry
  >;

  private _entityRows: Array<LovelaceRow | HuiErrorCard> = [];

  protected shouldUpdate(changedProps: PropertyValues) {
    if (changedProps.has("hass") && changedProps.size === 1) {
      this._entityRows.forEach((element) => {
        element.hass = this.hass;
      });
      return false;
    }
    return true;
  }

  protected render(): TemplateResult {
    const disabledEntities: EntityRegistryStateEntry[] = [];
    this._entityRows = [];
    return html`
      <ha-card .header=${this.header}>
        ${this.entities.length
          ? html`
              <div id="entities" @hass-more-info=${this._overrideMoreInfo}>
                ${this.entities.map((entry: EntityRegistryStateEntry) => {
                  if (entry.disabled_by) {
                    if (this._extDisabledEntityEntries) {
                      disabledEntities.push(
                        this._extDisabledEntityEntries[entry.entity_id] || entry
                      );
                    } else {
                      disabledEntities.push(entry);
                    }
                    return "";
                  }
                  return this.hass.states[entry.entity_id]
                    ? this._renderEntity(entry)
                    : this._renderEntry(entry);
                })}
              </div>
              ${disabledEntities.length
                ? !this.showDisabled
                  ? html`
                      <button
                        class="show-more"
                        @click=${this._toggleShowDisabled}
                      >
                        ${this.hass.localize(
                          "ui.panel.config.devices.entities.disabled_entities",
                          "count",
                          disabledEntities.length
                        )}
                      </button>
                    `
                  : html`
                      ${disabledEntities.map((entry) =>
                        this._renderEntry(entry)
                      )}
                      <button
                        class="show-more"
                        @click=${this._toggleShowDisabled}
                      >
                        ${this.hass.localize(
                          "ui.panel.config.devices.entities.hide_disabled"
                        )}
                      </button>
                    `
                : ""}
              <div class="card-actions">
                <mwc-button @click=${this._addToLovelaceView}>
                  ${this.hass.localize(
                    "ui.panel.config.devices.entities.add_entities_lovelace"
                  )}
                </mwc-button>
              </div>
            `
          : html`
              <div class="empty card-content">
                ${this.hass.localize("ui.panel.config.devices.entities.none")}
              </div>
            `}
      </ha-card>
    `;
  }

  private _toggleShowDisabled() {
    this.showDisabled = !this.showDisabled;
    if (!this.showDisabled || this._extDisabledEntityEntries !== undefined) {
      return;
    }
    this._extDisabledEntityEntries = {};
    const toFetch = this.entities.filter((entry) => entry.disabled_by);

    const worker = async () => {
      if (toFetch.length === 0) {
        return;
      }

      const entityId = toFetch.pop()!.entity_id;
      const entry = await getExtendedEntityRegistryEntry(this.hass, entityId);
      this._extDisabledEntityEntries![entityId] = entry;
      this.requestUpdate("_extDisabledEntityEntries");
      worker();
    };

    // Fetch 3 in parallel
    worker();
    worker();
    worker();
  }

  private _renderEntity(entry: EntityRegistryStateEntry): TemplateResult {
    const config: LovelaceRowConfig = {
      entity: entry.entity_id,
    };

    const element = createRowElement(config);
    if (this.hass) {
      element.hass = this.hass;
      const stateObj = this.hass.states[entry.entity_id];
      const name = stripPrefixFromEntityName(
        computeStateName(stateObj),
        `${this.deviceName} `.toLowerCase()
      );
      if (name) {
        config.name = name;
      }
    }
    // @ts-ignore
    element.entry = entry;
    this._entityRows.push(element);
    return html` <div>${element}</div> `;
  }

  private _renderEntry(entry: EntityRegistryStateEntry): TemplateResult {
    const name =
      entry.stateName ||
      entry.name ||
      (entry as ExtEntityRegistryEntry).original_name;

    return html`
      <paper-icon-item
        class="disabled-entry"
        .entry=${entry}
        @click=${this._openEditEntry}
      >
        <ha-svg-icon
          slot="item-icon"
          .path=${domainIcon(computeDomain(entry.entity_id))}
        ></ha-svg-icon>
        <paper-item-body>
          <div class="name">
            ${name
              ? stripPrefixFromEntityName(
                  name,
                  `${this.deviceName} `.toLowerCase()
                ) || name
              : entry.entity_id}
          </div>
        </paper-item-body>
      </paper-icon-item>
    `;
  }

  private _overrideMoreInfo(ev: Event): void {
    ev.stopPropagation();
    const entry = (ev.target! as any).entry;
    showEntityEditorDialog(this, {
      entry,
      entity_id: entry.entity_id,
    });
  }

  private _openEditEntry(ev: Event): void {
    const entry = (ev.currentTarget! as any).entry;
    showEntityEditorDialog(this, {
      entry,
      entity_id: entry.entity_id,
    });
  }

  private _addToLovelaceView(): void {
    addEntitiesToLovelaceView(
      this,
      this.hass,
      this.entities
        .filter((entity) => !entity.disabled_by)
        .map((entity) => entity.entity_id),
      this.deviceName
    );
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }
      ha-icon {
        margin-left: 8px;
      }
      .entity-id {
        color: var(--secondary-text-color);
      }
      .buttons {
        text-align: right;
        margin: 0 0 0 8px;
      }
      .disabled-entry {
        color: var(--secondary-text-color);
      }
      #entities {
        margin-top: -24px; /* match the spacing between card title and content of the device info card above it */
      }
      #entities > * {
        margin: 8px 16px 8px 8px;
      }
      #entities > paper-icon-item {
        margin: 0;
      }
      paper-icon-item {
        min-height: 40px;
        padding: 0 16px;
        cursor: pointer;
        --paper-item-icon-width: 48px;
      }
      .name {
        font-size: 14px;
      }
      .empty {
        text-align: center;
      }
      button.show-more {
        color: var(--primary-color);
        text-align: left;
        cursor: pointer;
        background: none;
        border-width: initial;
        border-style: none;
        border-color: initial;
        border-image: initial;
        padding: 16px;
        font: inherit;
      }
      button.show-more:focus {
        outline: none;
        text-decoration: underline;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-device-entities-card": HaDeviceEntitiesCard;
  }
}
