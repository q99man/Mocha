package com.motionchallenge.admin.dto;

import java.util.List;

public record AdminMemberOverviewResponse(
        long totalCount,
        long adminCount,
        long userCount,
        List<AdminMemberSummaryResponse> recentMembers) {
}
