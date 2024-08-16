import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import memoizeOne from "memoize-one";
import { fireEvent } from "../../../../common/dom/fire_event";
import { LocalizeFunc } from "../../../../common/translations/localize";
import {
  HaFormSchema,
  SchemaUnion,
} from "../../../../components/ha-form/types";
import {
  isStrategySection,
  LovelaceGridSectionConfig,
  LovelaceSectionRawConfig,
} from "../../../../data/lovelace/config/section";
import { HomeAssistant } from "../../../../types";
import { DEFAULT_COLUMN_BASE } from "../../sections/hui-grid-section";

type ColumnDensity = "default" | "dense" | "custom";

type SettingsData = {
  title: string;
  column_density?: ColumnDensity;
};

@customElement("hui-section-settings-editor")
export class HuiDialogEditSection extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public config!: LovelaceSectionRawConfig;

  private _schema = memoizeOne(
    (
      localize: LocalizeFunc,
      type?: string | undefined,
      columnDensity?: ColumnDensity,
      columnBase?: number
    ) =>
      [
        {
          name: "title",
          selector: { text: {} },
        },
        ...(type === "grid"
          ? ([
              {
                name: "column_density",
                default: "default",
                selector: {
                  select: {
                    mode: "list",
                    options: [
                      {
                        label: localize(
                          `ui.panel.lovelace.editor.edit_section.settings.column_density_options.default`,
                          { count: 4 }
                        ),
                        value: "default",
                      },
                      {
                        label: localize(
                          `ui.panel.lovelace.editor.edit_section.settings.column_density_options.dense`,
                          { count: 6 }
                        ),
                        value: "dense",
                      },
                      ...(columnDensity === "custom" && columnBase
                        ? [
                            {
                              label: localize(
                                `ui.panel.lovelace.editor.edit_section.settings.column_density_options.custom`,
                                { count: columnBase }
                              ),
                              value: "custom",
                            },
                          ]
                        : []),
                    ],
                  },
                },
              },
            ] as const satisfies readonly HaFormSchema[])
          : []),
      ] as const satisfies HaFormSchema[]
  );

  private _isGridSectionConfig(
    config: LovelaceSectionRawConfig
  ): config is LovelaceGridSectionConfig {
    return !isStrategySection(config) && config.type === "grid";
  }

  render() {
    const columnBase = this._isGridSectionConfig(this.config)
      ? this.config.column_base || DEFAULT_COLUMN_BASE
      : undefined;

    const columnDensity =
      columnBase === 6 ? "dense" : columnBase === 4 ? "default" : "custom";

    const data: SettingsData = {
      title: this.config.title || "",
      column_density: columnDensity,
    };

    const type = "type" in this.config ? this.config.type : undefined;

    const schema = this._schema(
      this.hass.localize,
      type,
      columnDensity,
      columnBase
    );

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) =>
    this.hass.localize(
      `ui.panel.lovelace.editor.edit_section.settings.${schema.name}`
    );

  private _computeHelper = (
    schema: SchemaUnion<ReturnType<typeof this._schema>>
  ) =>
    this.hass.localize(
      `ui.panel.lovelace.editor.edit_section.settings.${schema.name}_helper`
    ) || "";

  private _valueChanged(ev: CustomEvent) {
    ev.stopPropagation();
    const newData = ev.detail.value as SettingsData;

    const { title, column_density } = newData;

    const newConfig: LovelaceSectionRawConfig = {
      ...this.config,
      title,
    };

    if (this._isGridSectionConfig(newConfig)) {
      const column_base =
        column_density === "default"
          ? 4
          : column_density === "dense"
            ? 6
            : undefined;

      if (column_base) {
        (newConfig as LovelaceGridSectionConfig).column_base = column_base;
      }
    }

    if (!newConfig.title) {
      delete newConfig.title;
    }

    fireEvent(this, "value-changed", { value: newConfig });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-section-settings-editor": HuiDialogEditSection;
  }
}
