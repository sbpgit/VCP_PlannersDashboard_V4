sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, Filter,
    FilterOperator, formatter) => {
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
            this.getLocProd();

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
        },
        onResetData: function () {
            sap.ui.core.BusyIndicator.show();
            this.onAfterRendering();
        },


        // Refresh method to reload alert data
        onRefreshAlerts: function () {

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
                return {
                    category: group,
                    count: data.count,
                    success: data.success,
                    warning: data.warning,
                    error: data.error,
                    icon: that._getSystemGroupIcon(group),
                    severity: that._determineSystemSeverity(data.success, data.warning, data.error)
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
                            "text": "System Active",
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
                                "value": "✓ {success} | ⚠ {warning} | ✗ {error}",
                                "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }"
                            },
                            "actions": [
                                {
                                    "type": "Custom",
                                    "parameters": {
                                        // "url": "{targetApp}",
                                        // "target": "_blank",
                                        "actionId": "{category}"
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
                            "src": "sap-icon://activities"
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
        _getTargetForCategory: async function (category) {
            try {
                // ✅ Use async version to get the service
                const oCrossAppNavigator = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");
                let sIntent;

                switch (category) {
                    case "PROCESS_JOBS":
                        sIntent = await oCrossAppNavigator.hrefForExternalAsync({
                            target: {
                                semanticObject: "jobschedulersequence",
                                action: "display"
                            }
                        });
                        break;

                    case "INTERFACE":
                        sIntent = await oCrossAppNavigator.hrefForExternalAsync({
                            target: {
                                semanticObject: "vcpappvcpinterface",
                                action: "Display"
                            }
                        });
                        break;

                    default:
                        sIntent = "#Shell-home";
                        break;
                }

                return sIntent;

            } catch (err) {
                console.error("Error while generating intent:", err);
                return "#Shell-home";
            }
        }
        ,


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
                lowerMessage.includes("no planning") || lowerMessage.includes("insufficient") ||lowerMessage.includes("no content") ) {
                return "Error";
            } else if (lowerMessage.includes('warning') || lowerMessage.includes('timeout')) {
                return "Warning";
            }
            else if (lowerMessage.includes('success') || lowerMessage.includes('good') 
                || lowerMessage.includes('yes')||lowerMessage.includes('changed')) {
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

            if (oSystemCard) that._showEmptyAlertsCard("System Alerts", "MyCardId");
            if (oDataCard) that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
            if (oExceptionalCard) that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
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
                    var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local);
                    oStorage.put("nodeId", 58);
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
        }


    });
});

