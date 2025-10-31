sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter",
    'sap/ui/core/Fragment'
], (Controller, JSONModel, MessageToast, MessageBox, Filter,
    FilterOperator, formatter, Fragment) => {
    "use strict";
    var that;
    return Controller.extend("vcp.vcplannerdashboard.controller.View1", {
        formatter: formatter,
        onInit: function () {
            this.oModel = this.getOwnerComponent().getModel();
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            var sRootPath = jQuery.sap.getModulePath("vcp/vcplannerdashboard", "/");
            this.byId("idHeaderImage").setSrc(sRootPath + "image/logo.png");
            // this.loadAlertsCards();
        },

        onAfterRendering: function () {
            that = this;
            that.oGModel = that.getOwnerComponent().getModel("oGModel");
            sap.ui.core.BusyIndicator.show();
            that.viewDetails = new JSONModel();
            that.viewDetails.setSizeLimit(5000);
            that.variantModel = new JSONModel();
            that.variantModel.setSizeLimit(5000);
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            that.newChartData = [];
            that.CalendarData = [], that.assemblyData = [], that.cardData = [],
                that.totalAssemblyData = [], that.forecastData = [], that.totalOptMixData = [], that.monthData = [];
            this.getLocProd();
            // this._showEmptyAlertsCard("Assembly Lag Analysis", "idWFModel");
            this._showEmptyAlertsCard("Characteristic Percentage", "MyCardIdChar");
            this._showEmptyAlertsCard("ForecastActual & Forecast", "MyCardIdFore");
            this.loadAlertsCards();
            setTimeout(function () {
                // this.loadAlertsCards();
            }.bind(this), 1000);
        },
        // v4 oData
        getLocProd: function () {
            this.oModel.bindList("/getfactorylocdesc")
                .requestContexts()
                .then((aContexts) => {
                    const results = aContexts.map(oContext => oContext.getObject());

                    if (results?.length > 0) {
                        that.oGModel.setProperty("/fullLocProdData", results);
                        this.processData(results);
                    } else {
                        sap.m.MessageToast.show("No data available for Locations and Products");
                    }

                    sap.ui.core.BusyIndicator.hide();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Read failed:", oError);
                    sap.m.MessageBox.error("Failed to load data: " + oError.message);
                });
        },

        processData: function (results) {
            // Remove duplicates and sort
            this.locationData = this.removeDuplicates(results, "DEMAND_LOC");
            this.locationData.sort((a, b) => a.DEMAND_DESC.localeCompare(b.DEMAND_DESC));

            this.prodData = this.removeDuplicates(results, "PRODUCT_ID");
            this.prodData.sort((a, b) => a.PROD_DESC.localeCompare(b.PROD_DESC));

            // Set models
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results1: this.locationData }),
                "locModel"
            );
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results2: this.prodData }),
                "prodModel"
            );

            // Clear selections
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");

            // Load cards
            this._loadForecastCard();
            // this.loadProcessAlertsCard();
        },

        // Remove duplicates based on a specific key
        removeDuplicates: function (data, key) {
            const seen = new Set();
            return data.filter(item => {
                const value = item[key];
                if (seen.has(value)) {
                    return false;
                }
                seen.add(value);
                return true;
            });
        },

        // -------------------
        // Load Forecast Data
        // -------------------
        _loadForecastCard: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardId2");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();

            // Build filter array for OData V4
            const aFilters = [];

            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            // sap.ui.core.BusyIndicator.show();
            try {
                // Use bindList with filters, similar to your working example
                oModel.bindList("/getForecastSnapshotLag", null, [], aFilters)
                    .requestContexts()
                    .then((aContexts) => {
                        const results = aContexts.map(oContext => oContext.getObject());

                        if (Array.isArray(results) && results.length > 0) {
                            const chartData = this._prepareChartData(results);
                            const oManifest = this._buildCardManifest(
                                chartData,
                                "Forecast Snapshot Lag Analysis",
                                "Forecast",
                                results
                            );
                            this._applyCardManifest("MyCardId2", oManifest);
                        } else {
                            console.warn("No forecast data found for selected filters");
                            // sap.m.MessageToast.show("No forecast data available");
                            this._showEmptyAlertsCard("Forecast Snapshot Lag Analysis", "MyCardId2")
                        }

                        // sap.ui.core.BusyIndicator.hide();
                    })
                // .catch((oError) => {
                //     // sap.ui.core.BusyIndicator.hide();
                //     console.error("Forecast data request failed:", oError);
                //     sap.m.MessageBox.error("Failed to load forecast data: " + (oError.message || "Unknown error"));
                // });
            } catch (error) {
                sap.m.MessageBox.error("Failed to load forecast data: " + (error.message || "Unknown error"));
            } finally {
                if (oCard) oCard.setBusy(false);
            }
        },


        // -------------------
        // Load Assembly Data
        // -------------------
        _loadAssemblyCard: function () {
            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            const locSelectedKeyAsmb = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKeyAsmb = this.byId("productSelect").getSelectedKey();

            const aFilters = [];

            // Add filters only if values are selected
            if (locSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKeyAsmb));
            }

            if (prodSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKeyAsmb));
            }

            sap.ui.core.BusyIndicator.show();

            // OData V4 approach using bindContext
            const oBindingContext = oModel.bindContext("/getAssemblySnapshotLag", null, {
                filters: aFilters.length > 0 ? aFilters : undefined,
                operationMode: "Server"
            });

            oBindingContext.requestObject()
                .then((oData) => {
                    // OData V4 returns data in 'value' property
                    const results = oData.value || [];
                    if (results.length > 0) {
                        const chartData = this._prepareChartData(results);
                        const oManifest = this._buildCardManifest(
                            chartData,
                            "Assembly Snapshot Lag Analysis",
                            "Assembly",
                            results
                        );
                        this._applyCardManifest("MyCardId2", oManifest);
                    }
                    else {
                        this._showEmptyAlertsCard("Assembly Lag snapshot analysis", "MyCardId2")
                    }

                    sap.ui.core.BusyIndicator.hide();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Read failed for assembly:", oError);
                    sap.m.MessageBox.error("Failed to load assembly data: " + (oError.message || "Unknown error"));
                });
        },

        // -------------------
        // Utility: transform data into chart format
        // -------------------
        _prepareChartData: function (aResults) {
            if (!aResults || aResults.length === 0) return [];

            var periodMap = {};
            aResults.forEach(function (item) {
                var period = item.YEAR_MONTH;
                if (!periodMap[period]) {
                    periodMap[period] = {
                        period: period,
                        lag1Values: [], lag2Values: [], lag3Values: [],
                        lag4Values: [], lag5Values: []
                    };
                }
                if (item.LAG1_CIR != null) periodMap[period].lag1Values.push(parseFloat(item.LAG1_CIR));
                if (item.LAG2_CIR != null) periodMap[period].lag2Values.push(parseFloat(item.LAG2_CIR));
                if (item.LAG3_CIR != null) periodMap[period].lag3Values.push(parseFloat(item.LAG3_CIR));
                if (item.LAG4_CIR != null) periodMap[period].lag4Values.push(parseFloat(item.LAG4_CIR));
                if (item.LAG5_CIR != null) periodMap[period].lag5Values.push(parseFloat(item.LAG5_CIR));
            });

            var chartData = [];
            Object.keys(periodMap).sort().forEach(function (period) {
                var data = periodMap[period];
                chartData.push({
                    period: period,
                    lag1: data.lag1Values.length ? data.lag1Values.reduce((a, b) => a + b, 0) / data.lag1Values.length : 0,
                    lag2: data.lag2Values.length ? data.lag2Values.reduce((a, b) => a + b, 0) / data.lag2Values.length : 0,
                    lag3: data.lag3Values.length ? data.lag3Values.reduce((a, b) => a + b, 0) / data.lag3Values.length : 0,
                    lag4: data.lag4Values.length ? data.lag4Values.reduce((a, b) => a + b, 0) / data.lag4Values.length : 0,
                    lag5: data.lag5Values.length ? data.lag5Values.reduce((a, b) => a + b, 0) / data.lag5Values.length : 0
                });
            });

            return chartData;
        },

        // -------------------
        // Utility: build card manifest
        // -------------------
        _buildCardManifest: function (chartData, sTitle, sSelected, oData) {
            return {
                "sap.app": {
                    "id": "vcp.v4card.forecast",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "Analytical",
                    "data": { "json": chartData },
                    "header": {
                        "type": "Numeric",
                        "title": sTitle,
                        "subTitle": "Comparison across lag periods",
                        "mainIndicator": {
                            "number": chartData.length,
                            "unit": "Periods",
                            "state": "Good"
                        },
                        "sideIndicators": [
                            { "title": "Total Records", "number": oData.length, "unit": "Records" },
                            { "title": "Unique Periods", "number": chartData.length, "unit": "Months" }
                        ]
                    },
                    "configuration": {
                        "filters": {
                            "Lag": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": sSelected, // either "Forecast" or "Assembly"
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{text}",
                                        "title": "{text}"
                                    }
                                },
                                "data": {
                                    "json": [
                                        { "text": "Forecast" },
                                        { "text": "Assembly" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "chartType": "column",
                        "title": { "text": sTitle },
                        "legend": { "visible": true },
                        "data": { "path": "/" },
                        "dimensions": [
                            { "label": "Period", "value": "{period}" }
                        ],
                        "measures": [
                            { "label": "Lag 1", "value": "{lag1}" },
                            { "label": "Lag 2", "value": "{lag2}" },
                            { "label": "Lag 3", "value": "{lag3}" },
                            { "label": "Lag 4", "value": "{lag4}" },
                            { "label": "Lag 5", "value": "{lag5}" }
                        ],
                        "feeds": [
                            { "uid": "categoryAxis", "type": "Dimension", "values": ["Period"] },
                            { "uid": "valueAxis", "type": "Measure", "values": ["Lag 1", "Lag 2", "Lag 3", "Lag 4", "Lag 5"] }
                        ]
                    }
                }
            };
        },
        // -------------------
        // Event: filter change
        // -------------------
        onFilterChange: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges && mChanges["/sap.card/configuration/filters/Lag/value"]) {
                var selected = mChanges["/sap.card/configuration/filters/Lag/value"];
                console.log("Dropdown changed:", selected);

                if (selected === "Forecast") {
                    this._loadForecastCard();
                } else if (selected === "Assembly") {
                    this._loadAssemblyCard();
                }
            }
        },
        // -------------------
        // Utility: apply manifest and attach filter change
        // -------------------
        _applyCardManifest: function (sCardId, oManifest) {
            var oCard = this.byId(sCardId);
            if (oCard) {
                oCard.setManifest(oManifest);

                // attach configurationChange instead of filterChange
                oCard.detachConfigurationChange(this.onFilterChange, this);
                oCard.attachConfigurationChange(this.onFilterChange, this);
            }
            sap.ui.core.BusyIndicator.hide();
        },
        onLocationChange: function () {
            var selectedData = this.byId("LocationSelect").getSelectedKey();
            var filteredProdData = this.prodData.filter(a => a.DEMAND_LOC === selectedData);
            var oJSONProduct = new sap.ui.model.json.JSONModel({ results2: filteredProdData });
            this.getView().setModel(oJSONProduct, "prodModel");
        },
        onGetData: function () {
            this._loadForecastCard();
            this.loadAlertsCards();
            that.loadAllLags();
            this._loadCharCards();
        },
        onResetData: function () {
            sap.ui.core.BusyIndicator.show();
            const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: [] });
            this.getView().setModel(oAssemblyModel, "assembly");
            const calendarModel = new sap.ui.model.json.JSONModel({ MONTH: [] });
            that.getView().setModel(calendarModel, "calendar");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: [] });
            this.getView().setModel(oModel, "filters");
            //Reset asselbly lag
            that.onFilterResetAssembly();
            this.onAfterRendering();

        },

        // Main method to Data alerts using V4 OData
        loadAlertsCards: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel(); // V4 OData model
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();

            // Build filter array for OData V4
            const aFilters = [];

            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            // Use bindList and requestContexts for V4 OData
            oModel.bindList("/getPlannerAlerts", null, [], aFilters).requestContexts().then(function (aContexts) {
                console.log("[V4 Alerts] Received contexts:", aContexts);

                if (aContexts && aContexts.length > 0) {
                    // Extract data from V4 contexts
                    var rawData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                    console.log("[V4 Alerts] Raw data:", rawData);

                    // Process the data using your existing logic
                    that._processAlertsDataV4(rawData);

                } else {
                    console.warn("[V4 Alerts] No data received -> show empty cards");
                    that._setEmptyAlertCards();
                }
            }).catch(function (oError) {
                console.error("[V4 Alerts] Error loading data:", oError);
                that._setEmptyAlertCards();
            });
        },


        // V4 OData data processing with all three cards
        _processAlertsDataV4: function (oData) {
            var that = this;

            // Normalize incoming V4 payload
            var results = [];
            try {
                results = Array.isArray(oData) ? oData : (oData.value || []);
            } catch (e) {
                console.error("[V4 Alerts] Error parsing data:", e);
                results = [];
            }

            console.log("[V4 Alerts] raw results length:", results.length);

            if (!results || results.length === 0) {
                console.warn("[V4 Alerts] No alerts -> show empty cards");
                that._setEmptyAlertCards();
                return;
            }

            // Keep only VCPLANNER alerts
            var vcAlerts = results.filter(function (it) {
                return it && it.APPL === "VCPLANNER";
            });

            if (vcAlerts.length === 0) {
                that._setEmptyAlertCards();
                return;
            }

            console.log("[V4 Alerts] All VCPLANNER alerts:", vcAlerts);

            // DATA ALERTS: Only MSGGRP = "DATA"
            var dataAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS";
            });

            // SYSTEM ALERTS: PROCESS_JOBS, INTERFACE, RESTRICTIONS
            var systemAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS" || a.MSGGRP === "INTERFACE" || a.MSGGRP === "RESTRICTIONS";
            });

            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var exceptionalAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "DATA";
            });

            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var interfaceAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "INTERFACE";
            });

            console.log("[V4 Alerts] Filtered - Data:", dataAlerts.length, "System:", systemAlerts.length, "Exception:", exceptionalAlerts.length);

            // Process DATA ALERTS card data - show individual messages
            var dataAlertsCardData = dataAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("data-" + idx),
                    title: a.MSGTXT || "Data alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://activities",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            // Process SYSTEM ALERTS card data - show grouped counts
            var systemGroups = {
                "PROCESS_JOBS": { count: 0, success: 0, warning: 0, error: 0 },
                "INTERFACE": { count: 0, success: 0, warning: 0, error: 0 },
                "RESTRICTIONS": { count: 0, success: 0, warning: 0, error: 0 }
            };

            systemAlerts.forEach(function (a) {
                var group = a.MSGGRP;
                if (systemGroups[group]) {
                    systemGroups[group].count += 1;
                    systemGroups[group].success += Number(a.SUCCESS_COUNT || 0);
                    systemGroups[group].warning += Number(a.WARNING_COUNT || 0);
                    systemGroups[group].error += Number(a.ERROR_COUNT || 0);
                }
            });

            // Convert to array format for the card
            var systemAlertsCardData = Object.keys(systemGroups).map(function (group) {
                var data = systemGroups[group];
                var displayNameMap = {
                    "PROCESS_JOBS": "Process Jobs",
                    "INTERFACE": "Interface",
                    "RESTRICTIONS": "Restrictions"
                };

                return {
                    category: displayNameMap[group] || group,
                    count: data.count,
                    success: data.success,
                    warning: data.warning,
                    error: data.error,
                    icon: that._getSystemGroupIcon(group),
                    severity: that._determineSystemSeverity(data.success, data.warning, data.error),
                    rawCategory: group
                };
            }).filter(function (item) {
                return item.count > 0; // Only show groups with alerts
            });

            // Process EXCEPTIONAL ALERTS card data - show individual messages
            var exceptionalAlertsCardData = exceptionalAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("exceptional-" + idx),
                    title: a.MSGTXT || "Exception alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://alert",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            var interfaceAlertsCardData = interfaceAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("interface-" + idx),
                    title: a.MSGTXT || "Interface alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://connected",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            console.log("[V4 Alerts] System groups data:", systemAlertsCardData);
            console.log("[V4 Alerts] Exception alerts:", exceptionalAlertsCardData);
            console.log("[V4 Alerts] Interface alerts:", interfaceAlertsCardData);

            // Bind to all three cards
            that._bindAlertsToCardsExact(dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData);
        },

        // Binding method for all three cards
        _bindAlertsToCardsExact: function (dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData) {
            var that = this;

            // Get card references
            var oSystemCard = that.byId("MyCardId");     // System Alerts (700px)
            var oDataCard = that.byId("MyCardId1");      // Data Alerts (350px)
            var oExceptionalCard = that.byId("MyCardId3"); // Exceptional Alerts (300px)
            var oInterfaceCard = that.byId("MyCardId4")
            try {
                // SYSTEM ALERTS CARD - Grouped counts
                if (oSystemCard) {
                    if (systemAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("System Alerts", "MyCardId");
                    } else {
                        oSystemCard.setManifest(
                            that._createSystemAlertsCardManifestExact(systemAlertsCardData)
                        );
                        // ✅ Attach the click event
                        oSystemCard.detachAction(this.onCardAction, this);
                        oSystemCard.attachAction(this.onCardAction, this);
                        console.log("[V4 Alerts] System card bound with", systemAlertsCardData.length, "groups");
                    }
                }

                // DATA ALERTS CARD - Individual messages
                if (oDataCard) {
                    if (dataAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
                    } else {
                        oDataCard.setManifest(
                            that._createDataAlertsCardManifestExact(dataAlertsCardData)
                        );
                        console.log("[V4 Alerts] Data card bound with", dataAlertsCardData.length, "alerts");
                    }
                }

                // EXCEPTIONAL ALERTS CARD - Individual messages with severity
                if (oExceptionalCard) {
                    if (exceptionalAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
                    } else {
                        oExceptionalCard.setManifest(
                            that._createExceptionalAlertsCardManifest(exceptionalAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", exceptionalAlertsCardData.length, "alerts");
                    }
                }

                // INTERFACE ALERTS CARD - Individual messages 
                if (oInterfaceCard) {
                    if (interfaceAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
                    } else {
                        oInterfaceCard.setManifest(
                            that._createInterfaceAlertsCardManifest(interfaceAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", interfaceAlertsCardData.length, "alerts");
                    }
                }

                console.log("[V4 Alerts] All three cards updated successfully");

            } catch (error) {
                console.error("[V4 Alerts] Error binding cards:", error);
                that._setEmptyAlertCards();
            }
        },

        // SYSTEM ALERTS CARD - Show grouped counts in exact format
        _createSystemAlertsCardManifestExact: function (data) {
            var safeData = data || [];
            data.forEach(item => {
                if (item.error > 0) item.state = "Error";
                else if (item.warning > 0) item.state = "Warning";
                else item.state = "Success";
                // item.targetApp = await this._getTargetForCategory(item.category);
                item.targetApp = item.category;
            });

            return {
                "sap.app": {
                    "id": "vcp.v4card.systemalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "System Alerts",
                        "subTitle": "Process, Interface & Restriction Status",
                        "icon": {
                            "src": "sap-icon://process"
                        },
                        "status": {
                            "text": "",
                            "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{category}",
                            "description": "{count} alert(s)",
                            "highlight": "{severity}",
                            "icon": { "src": "{icon}" },
                            "info": {
                                "value": "✅ {success} ⚠ {warning} ❌ {error}",
                                "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }",

                            },

                            "actions": [
                                {
                                    "type": "Custom",
                                    "parameters": {
                                        "actionId": "{rawCategory}"
                                    }
                                }
                            ]
                        }
                    }
                }
            };
        },

        // DATA ALERTS CARD - Show individual messages
        _createDataAlertsCardManifestExact: function (data) {
            var safeData = data || [];


            return {
                "sap.app": {
                    "id": "vcp.v4card.dataalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Data Alerts",
                        "subTitle": "Issues in VC Planner data processing",
                        "icon": {
                            "src": "sap-icon://activities",
                            "width": "70px"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            "state": safeData.length > 0 ? "Warning" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" }
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // EXCEPTIONAL ALERTS CARD - Show individual messages with severity
        _createExceptionalAlertsCardManifest: function (data) {
            var safeData = data || [];

            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Exception Alerts",
                        "subTitle": "Critical exceptions",
                        "icon": {
                            "src": "sap-icon://critical-issue"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            // "state": safeData.length > 0 ? "Error" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                            // "info": {
                            //     "value": "{severity}",
                            //     "state": "{= ${severity} === 'High' ? 'Error' : ${severity} === 'Medium' ? 'Warning' : 'Information' }"
                            // }
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // INTERFACE ALERTS CARD - Show individual messages 
        _createInterfaceAlertsCardManifest: function (data) {
            var safeData = data || [];

            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Interface Alerts",
                        "subTitle": "Interface system Alerts",
                        "icon": {
                            "src": "sap-icon://connected"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // Determine severity for exceptional alerts
        _determineExceptionalSeverity: function (message) {
            if (!message) return "Information";

            var lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('error') || lowerMessage.includes('failed') ||
                lowerMessage.includes('critical') || lowerMessage.includes('fatal') ||
                lowerMessage.includes("no planning") || lowerMessage.includes("insufficient") || lowerMessage.includes("no content")) {
                return "Error";
            } else if (lowerMessage.includes('warning') || lowerMessage.includes('timeout')) {
                return "Warning";
            }
            else if (lowerMessage.includes('success') || lowerMessage.includes('good')
                || lowerMessage.includes('yes')) {
                return "Success";
            }
            return "Information";
        },

        // Determine severity for system alerts
        _determineSystemSeverity: function (success, warnings, errors) {
            if (errors > 0) {
                return "Error";
            } else if (warnings > 0 && errors === 0) {
                return "Warning";
            }
            else if (success > 0) {
                return "Success";
            }
            return "Information";
        },


        // System group icons
        _getSystemGroupIcon: function (group) {
            var iconMap = {
                "PROCESS_JOBS": "sap-icon://activities",
                "INTERFACE": "sap-icon://connected",
                "RESTRICTIONS": "sap-icon://limitation"
            };
            return iconMap[group] || "sap-icon://message-warning";
        },

        // Updated empty cards method for all three cards
        _setEmptyAlertCards: function () {
            var that = this;
            var oSystemCard = that.byId("MyCardId");
            var oDataCard = that.byId("MyCardId1");
            var oExceptionalCard = that.byId("MyCardId3");
            var oInterfaceCard = that.byId("MyCardId4")

            if (oSystemCard) that._showEmptyAlertsCard("System Alerts", "MyCardId");
            if (oDataCard) that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
            if (oExceptionalCard) that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
            if (oInterfaceCard) that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
        },

        _showEmptyAlertsCard: function (title, id) {
            var that = this;
            var oEmptyManifest = {
                "sap.app": {
                    "id": "vcp.v4card." + title.toLowerCase().replace(/\s/g, '') + ".empty",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": [{

                            }]
                        }
                    },
                    "header": {
                        "title": title,
                        "subTitle": "No active " + title + " found"
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}"
                            // "icon": { "src": "{icon}" }
                        }
                    }
                }
            };

            var oCard = that.byId(id);
            if (oCard) {
                oCard.setManifest(oEmptyManifest);
                console.log("[V4 Alerts] Empty card set for:", title);
            }
        },
        getUser: function () {
            let vUser;
            if (sap.ushell && sap.ushell.Container) {
                let email = sap.ushell.Container.getService("UserInfo")
                    .getUser()
                    .getEmail();
                vUser = email ? email : "";
            }
            return vUser;

        },
        onCardAction: async function (oEvent) {
            const oParams = oEvent.getParameters();
            const oAction = oParams.action || {}; // fallback
            const actionParams = oAction.parameters || oParams.parameters || {}; // safe fallback
            const actionId = actionParams.actionId;

            console.log("Card action triggered:", actionId);

            switch (actionId) {
                case "PROCESS_JOBS":
                    await this._navigateToProcessJobs();
                    break;

                case "INTERFACE":
                    await this._navigateToInterface();
                    break;

                case "RESTRICTIONS":
                    sap.m.MessageToast.show("Restriction alert clicked");
                    break;

                default:
                    sap.m.MessageToast.show("Unknown card action: " + actionId);
            }
        },
        _navigateToProcessJobs: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Process Jobs:", err);
            }
        },

        _navigateToInterface: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local);
                    oStorage.put("nodeId", 58);
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Interface:", err);
            }
        },

        _loadCharCards: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardIdFore");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }
            var aFilters = [];
            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            const aFilters1 = Array.isArray(aFilters) ? aFilters : [];

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            // while (bHasMore) {
            //     // var url = `/getDMDAnalytical?$filter=LOCATION_ID eq '1600'`
            //     const aContexts = await this.oModel
            //         .bindList("/getDMDAnalytical", null, [], aFilters1)
            //         .requestContexts(iSkip, iPageSize);

            //     const aPageResults = aContexts.map(ctx => ctx.getObject());

            //     aAllResults = aAllResults.concat(aPageResults);

            //     // If we got less than requested, it's the last page
            //     if (aPageResults.length < iPageSize) {
            //         bHasMore = false;
            //     } else {
            //         iSkip += iPageSize;
            //     }
            // }

            // console.log("Total records loaded:", aAllResults.length);

            // if (aAllResults.length === 0) {
            //     sap.m.MessageToast.show("No data available for selected Location & Product");
            // } else {

            //     that.forecastData = aAllResults;
            //     // const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: that.forecastData });
            //     this._setActualForecastCard(that.forecastData, "Week", "WEEK_DATE");
            // }
            oCard.setBusy(false);
        },

        _setActualForecastCard: function (oData, sName, sID) {
            const oManifest = {
                "sap.app": {
                    "id": "vcp.v4card.forecastQuantity",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "Analytical",
                    "header": {
                        "title": "Forecast Actual Quantity, Forecast Quantity",
                        "subTitle": "By " + sName,
                        "titleMaxLines": 1,
                        "subTitleMaxLines": 1
                    },
                    "data": {
                        "json": oData
                    },
                    "configuration": {
                        "filters": {
                            "Period": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": sName, // default value week
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{text}",
                                        "title": "{text}"
                                    }
                                },
                                "data": {
                                    "json": [
                                        { "text": "Week" },
                                        { "text": "Month" },
                                        { "text": "Year" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "title": {
                            "text": "Forecast Actual vs Forecast"

                        },
                        "chartType": "line",
                        "legend": { "visible": true },
                        "plotArea": {
                            "dataLabel": { "visible": true },
                            "window": { "start": 0, "end": 100 }
                        },
                        "dimensions": [
                            {
                                "name": sName,
                                "value": "{" + sID + "}"
                            }
                        ],
                        "measures": [
                            {
                                "name": "Forecast Actual Quantity",
                                "value": "{ACTUAL_QTY}"
                            },
                            {
                                "name": "Forecast Quantity",
                                "value": "{FORECAST_QTY}"
                            }
                        ],
                        "feeds": [
                            {
                                "uid": "categoryAxis",
                                "type": "Dimension",
                                "values": [sName]
                            },
                            {
                                "uid": "valueAxis",
                                "type": "Measure",
                                "values": ["Forecast Actual Quantity", "Forecast Quantity"]
                            }
                        ]
                    }
                }
            };

            this._applyCardManifestNew("MyCardIdFore", oManifest);

        },
        _applyCardManifestNew: function (sCardId, oManifest) {
            var oCard = this.byId(sCardId);
            if (oCard) {
                oCard.setManifest(oManifest);

                // attach configurationChange instead of filterChange
                oCard.detachConfigurationChange(this.onFilterChangePeriod, this);
                oCard.attachConfigurationChange(this.onFilterChangePeriod, this);
            }
            sap.ui.core.BusyIndicator.hide();
        },
        onFilterChangePeriod: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges) {
                if (Object.keys(mChanges).some(key => key.includes("Period"))) {
                    var selected = mChanges["/sap.card/configuration/filters/Period/value"];
                    if (selected === "Week") {
                        var sName = "Week";
                        var sID = "WEEK_DATE"
                    }
                    else if (selected === "Year") {
                        var sName = "Year";
                        var sID = "YEAR"
                    }
                    else if (selected === "Month") {
                        var sName = "Month";
                        var sID = "MONTH"
                    }
                    this._setActualForecastCard(that.newChartData, sName, sID);
                }
            }
        },

        handleCloseButton: function (oEvent) {
            this.byId("myPopover").close();
        },
        onOpenQuickHelp: function (oEvent) {
            var oButton = oEvent.getSource(),
                oView = this.getView();

            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "vcp.vcplannerdashboard.view.Popover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    // oPopover.bindElement("/ProductCollection/0");
                    return oPopover;
                });
            }
            this._pPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
        },
        handleLinkPress: async function (oEvent) {
            var selectedApp = oEvent.getSource().getText();
            try {
                switch (selectedApp) {
                    case "Option Mix Planning":
                        var semanticObject = "getOptionpercentages",
                            action = "display";
                        break;

                    case "Forecast Orders":
                        var semanticObject = "vcpforecastingorders",
                            action = "display";
                        break;
                    case "Assembly Requirements":
                        var semanticObject = "vcpmaterialrequirements",
                            action = "display";
                        break;
                    case "Restriction Likelihood":
                        var semanticObject = "vcpvendergoodcapacity",
                            action = "display";
                        break;

                    default:
                        break;
                }
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: semanticObject,
                            action: action
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to :", err);
            }
        },
        loadAllLags: async function () {
            await that.loadAssemblyLag();
            await that.loadOptMixLag();
            // await that.loadRtrLag();
            // await that.loadPrdDmdLag();
        },
        //Load assembly lag- start
        loadAssemblyLag: function () {
            var totalData = that.oGModel.getProperty("/fullLocProdData");
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            totalData = that.removeDuplicates(totalData.filter(id => id.DEMAND_LOC === locSelectedKey && id.PRODUCT_ID === prodSelectedKey), "FACTORY_LOC");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: totalData });
            this.getView().setModel(oModel, "filters");
            var oFactoryCombo = this.byId("cbFactory");
            setTimeout(() => {
                var aItems = oFactoryCombo.getItems();
                if (aItems.length > 0) {
                    oFactoryCombo.setSelectedKey(aItems[0].getKey());
                    oFactoryCombo.fireSelectionChange({ selectedItem: aItems[0] });
                }
            }, 200);

        },
        onFacLocChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getParameters().selectedItem.getKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getAssemblyData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {

                that.totalAssemblyData = aAllResults;
                that.assemblyData = this.removeDuplicates(aAllResults, "ASSEMBLY");
                const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: that.assemblyData });
                this.getView().setModel(oAssemblyModel, "assembly");
                setTimeout(() => {
                    var oAssembly = this.byId("cbAssembly");
                    var oBinding = oAssembly.getBinding("items");

                    if (oBinding) {
                        // oBinding.attachEventOnce("dataReceived", () => {
                        var aItems = oAssembly.getItems();
                        if (aItems.length > 0) {
                            oAssembly.setSelectedKey(aItems[0].getKey());
                            oAssembly.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                        // });
                    }
                }, 0);
            }

            // sap.ui.core.BusyIndicator.hide();
        },
        onAssemblyChange: function (oEvent) {
            var assemblySelected = oEvent.getParameters().selectedItem.getKey();
            var aAllResults = that.totalAssemblyData.filter(id => id.ASSEMBLY === assemblySelected);
            aAllResults = that.removeDuplicates(aAllResults, "MONTH");
            const calendarModel = new sap.ui.model.json.JSONModel({ MONTH: aAllResults });
            that.getView().setModel(calendarModel, "calendar");
            var oCalendar = this.byId("cbMonth");
            setTimeout(() => {
                var aItems = aAllResults;
                if (aItems.length > 0) {
                    oCalendar.setSelectedKey(aItems[0].MONTH);
                    oCalendar.fireSelectionChange({ selectedItem: aItems[0] });
                }
            }, 200);
        },

        onAssemblyGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var prod = this.byId("productSelect").getSelectedKey();
            var facloc = this.byId("cbFactory").getSelectedKey();
            var assembly = this.byId("cbAssembly").getSelectedKey();
            var month = this.byId("cbMonth").getSelectedKey();


            var oFunction = this.oModel.bindContext("/getAssemblyLagfun(...)");

            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("PRODUCT", prod);
            oFunction.setParameter("ASSEMBLY_ID", assembly);
            oFunction.setParameter("MONTH", month);

            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    that.setAssemblyCardManifest(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load Assembly Lag data");
            });

        },
        setAssemblyCardManifest: function (oData) {
            var oVizFrame = this.byId("idWFModel");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Assembly Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallData: oData });
            this.getView().setModel(oModel, "waterfallModel");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onFilterResetAssembly: function () {
            that.byId("cbFactory").setSelectedKey();
            that.byId("cbAssembly").setSelectedKey();
            that.byId("cbMonth").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallData: [] });
            this.getView().setModel(oModel, "waterfallModel");
            // that._showEmptyAlertsCard("Assembly Lag Analysis", "idWFModel")
        },
        //Load assembly lag- end
        //Load option mix lag- start
        loadOptMixLag: function () {
            var totalData = that.oGModel.getProperty("/fullLocProdData");
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            totalData = that.removeDuplicates(totalData.filter(id => id.DEMAND_LOC === locSelectedKey && id.PRODUCT_ID === prodSelectedKey), "FACTORY_LOC");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: totalData });
            this.getView().setModel(oModel, "filters");
            var oFactoryCombo = this.byId("cbFactoryPL");
            setTimeout(() => {
                var aItems = oFactoryCombo.getItems();
                if (aItems.length > 0) {
                    oFactoryCombo.setSelectedKey(aItems[0].getKey());
                    oFactoryCombo.fireSelectionChange({ selectedItem: aItems[0] });
                }
            }, 200);

        },
        onOptFacChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getParameters().selectedItem.getKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getOptPrtData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {

                that.totalOptMixData = aAllResults;
                that.monthData = this.removeDuplicates(aAllResults, "MONTH");
                const oMonthModel = new sap.ui.model.json.JSONModel({ Month: that.monthData });
                this.getView().setModel(oMonthModel, "calendarOpt");
                setTimeout(() => {
                    var oMonth = this.byId("cbMonthPL");
                    var oBinding = oMonth.getBinding("items");

                    if (oBinding) {
                        // oBinding.attachEventOnce("dataReceived", () => {
                        var aItems = oMonth.getItems();
                        if (aItems.length > 0) {
                            oMonth.setSelectedKey(aItems[0].getKey());
                            oMonth.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                        // });
                    }
                }, 0);
            }

            // sap.ui.core.BusyIndicator.hide();
        },
        onOptMonthChange: function (oEvent) {
            var monthSelected = oEvent.getParameters().selectedItem.getKey();
            var aAllResults = that.totalOptMixData.filter(id => id.MONTH === monthSelected);
            aAllResults = that.removeDuplicates(aAllResults, "CHAR_NUM");
            const charModel = new sap.ui.model.json.JSONModel({ CHARA_NUM: aAllResults });
            that.getView().setModel(charModel, "characteristic");

            setTimeout(() => {
                var oChar = this.byId("cbCharPL");
                var oCharBinding = oChar.getBinding("items");
                if (oCharBinding) {
                    var aItems = oChar.getItems();
                    if (aItems.length > 0) {
                        oChar.setSelectedKey(aItems[0].getKey());
                        oChar.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 200);
        },
        onOptCharChange: function (oEvent) {
            var charSelected = oEvent.getParameters().selectedItem.getKey();
            var monthSelected = that.byId("cbMonthPL").getSelectedKey();
            var aAllResults = that.totalOptMixData.filter(id => id.CHAR_NUM === charSelected && id.MONTH === monthSelected);
            aAllResults = that.removeDuplicates(aAllResults, "CHAR_VALUE");
            const charValModel = new sap.ui.model.json.JSONModel({ CHARA_VALUE: aAllResults });
            that.getView().setModel(charValModel, "characteristicValue");

            setTimeout(() => {
                var oCharVal = this.byId("cbCharValPL");
                var oCharValBinding = oCharVal.getBinding("items");
                if (oCharValBinding) {
                    var aItems = oCharVal.getItems();
                    if (aItems.length > 0) {
                        oCharVal.setSelectedKey(aItems[0].getKey());
                        oCharVal.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 200);
        },
        onOptMixGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var prod = this.byId("productSelect").getSelectedKey();
            var facloc = this.byId("cbFactoryPL").getSelectedKey();
            var characteristic = this.byId("cbCharPL").getSelectedKey();
            var monthOpt = this.byId("cbMonthPL").getSelectedKey();
            var charvalOpt  = this.byId("cbCharValPL").getSelectedKey();


            var oFunction = this.oModel.bindContext("/getOptPercentLagfun(...)");

            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("PRODUCT", prod);           
            oFunction.setParameter("MONTH", monthOpt);
             oFunction.setParameter("CHARACTERISTIC", characteristic);
             oFunction.setParameter("CHARACTERISTIC_VALUE", charvalOpt);

            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    that.setOptionCardManifest(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load Assembly Lag data");
            });

        },
        setOptionCardManifest: function (oData) {
            var oVizFrame = this.byId("idOptMixWF");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Option Mix Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataOpt: oData });
            this.getView().setModel(oModel, "waterfallModelOpt");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onFilterResetOption: function () {
            that.byId("cbFactoryPL").setSelectedKey();
            that.byId("cbMonthPL").setSelectedKey();
            that.byId("cbCharPL").setSelectedKey();
            that.byId("cbCharValPL").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallData: [] });
            this.getView().setModel(oModel, "waterfallModel");
            // that._showEmptyAlertsCard("Assembly Lag Analysis", "idWFModel")
        }

    });
});

