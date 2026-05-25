import { useState, useMemo, useRef } from 'react';
import { useSeasonalEvent } from '@/lib/seasonal';
import { ConfettiEffect } from '@/lib/seasonal/effects/ConfettiEffect';
import { useNavigate } from 'react-router-dom';
import { LogsDataTable } from '@/components/logs/LogsDataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Button } from '@/components/ui/button';
import { formatDate, normalizeDateForComparison } from '@/utils/formatting';
import { istToIso } from '@/utils/date';
import { useMyLogs, useTeamLogs } from '@/lib/query/hooks/useLogs';
import { useMyProjects, useProjects } from '@/lib/query/hooks/useProjects';
import { useUsers, useUsersByTeam } from '@/lib/query/hooks/useUsers';
import { useTeams } from '@/lib/query/hooks/useTeams';
import { useAuth } from '@/hooks/useAuth';
import { IconPlus } from '@tabler/icons-react';
import { ProjectProgressSummary } from '@/components/projects/ProjectProgressSummary';

export function DailyLog() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>({
    from: new Date(),
    to: new Date(),
  });

  // Single project filter for members
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Multi-select filters for admins
  const [selectedProjectIds, setSelectedProjectIds] = useState<(string | number)[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<(string | number)[]>([]);

  // Convert date range to IST strings for display and API
  const startDate = dateRange?.from ? formatDate(dateRange.from) : undefined;
  const endDate = dateRange?.to ? formatDate(dateRange.to) : undefined;

  // Fetch logs for the selected date range
  // If no date range is selected, fetch recent logs (last 30 days as fallback)
  // Convert IST dates to ISO for API calls
  const apiStartDate = startDate ? istToIso(startDate) : istToIso(formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const apiEndDate = endDate ? istToIso(endDate) : istToIso(formatDate(new Date()));

  // Fetch teams for admins (needed to determine team_id if user doesn't have one)
  const { data: teams = [] } = useTeams({ isAdmin });

  // Admin team selector state — default to user's own team or first team once loaded
  const defaultAdminTeamId = useMemo(() => {
    if (!isAdmin) return null;
    if (user?.team_id) return user.team_id;
    if (teams.length > 0) return teams[0].id;
    return null;
  }, [isAdmin, user?.team_id, teams]);

  const [selectedAdminTeamId, setSelectedAdminTeamId] = useState<number | null>(null);

  // Once teams load, auto-select the default if nothing selected yet
  const adminTeamId = useMemo(() => {
    if (!isAdmin) return null;
    return selectedAdminTeamId ?? defaultAdminTeamId;
  }, [isAdmin, selectedAdminTeamId, defaultAdminTeamId]);

  const handleAdminTeamChange = (teamId: number | null) => {
    setSelectedAdminTeamId(teamId);
    setSelectedProjectIds([]);
    setSelectedUserIds([]);
  };

  // Fetch data based on user role
  const { data: myLogs = [], isLoading: myLogsLoading } = useMyLogs(
    undefined,
    apiStartDate,
    apiEndDate,
    !isAdmin
  );
  const { data: teamLogs = [], isLoading: teamLogsLoading } = useTeamLogs(
    adminTeamId,
    { startDate: apiStartDate, endDate: apiEndDate }
  );
  const { data: myProjects = [], isLoading: myProjectsLoading } = useMyProjects();
  const { data: allProjects = [], isLoading: allProjectsLoading } = useProjects(adminTeamId, isAdmin);
  // Fetch users: for admins, fetch by team; for members, fetch all (for filter dropdown)
  const { data: allUsers = [], isLoading: allUsersLoading } = useUsers(isAdmin);
  const { data: teamUsers = [], isLoading: teamUsersLoading } = useUsersByTeam(adminTeamId, isAdmin, { includeInactive: true });
  const users = isAdmin ? teamUsers : allUsers;
  const usersLoading = isAdmin ? teamUsersLoading : allUsersLoading;

  // Use the appropriate data based on role
  const allLogs = isAdmin ? teamLogs : myLogs;
  const projects = isAdmin ? allProjects : myProjects;
  const logsLoading = isAdmin ? teamLogsLoading : myLogsLoading;
  const projectsLoading = isAdmin ? allProjectsLoading : myProjectsLoading;

  const filteredLogs = useMemo(() => {
    let filtered = allLogs;

    // Apply date filter on frontend to ensure accuracy (handles timezone issues)
    if (dateRange?.from && dateRange?.to) {
      const startDateStr = formatDate(dateRange.from);
      const endDateStr = formatDate(dateRange.to);
      filtered = filtered.filter((log) => {
        const logDateStr = normalizeDateForComparison(log.date);
        return logDateStr >= startDateStr && logDateStr <= endDateStr;
      });
    } else if (dateRange?.from) {
      const startDateStr = formatDate(dateRange.from);
      filtered = filtered.filter((log) => {
        const logDateStr = normalizeDateForComparison(log.date);
        return logDateStr >= startDateStr;
      });
    } else if (dateRange?.to) {
      const endDateStr = formatDate(dateRange.to);
      filtered = filtered.filter((log) => {
        const logDateStr = normalizeDateForComparison(log.date);
        return logDateStr <= endDateStr;
      });
    }

    // Apply filters based on role
    if (isAdmin) {
      // Admin: Multi-select project filter
      if (selectedProjectIds.length > 0) {
        filtered = filtered.filter((log) =>
          selectedProjectIds.includes(log.project_id)
        );
      }

      // Admin: Multi-select user filter
      if (selectedUserIds.length > 0) {
        filtered = filtered.filter((log) =>
          selectedUserIds.includes(log.user_id)
        );
      }
    } else {
      // Member: Single project filter
      if (selectedProjectId) {
        filtered = filtered.filter((log) => log.project_id === selectedProjectId);
      }
    }

    return filtered;
  }, [allLogs, dateRange, isAdmin, selectedProjectId, selectedProjectIds, selectedUserIds]);

  // Seasonal event — runaway button + confetti
  const seasonalEvent = useSeasonalEvent();
  const hasButtonPrank = seasonalEvent?.buttonPrank?.enabled ?? false;
  const dodgeCountRef = useRef(0);
  const maxDodgesRef = useRef(
    hasButtonPrank
      ? Math.floor(Math.random() * ((seasonalEvent?.buttonPrank?.maxDodges ?? 7) - (seasonalEvent?.buttonPrank?.minDodges ?? 3) + 1)) + (seasonalEvent?.buttonPrank?.minDodges ?? 3)
      : 0
  );
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });
  const [showFoolsToast, setShowFoolsToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleNewLog = () => {
    if (hasButtonPrank && dodgeCountRef.current < maxDodgesRef.current) {
      dodgeCountRef.current++;
      // Increase dodge distance as attempts grow — gets more frantic
      const intensity = 1 + dodgeCountRef.current * 0.3;
      const x = (Math.random() - 0.5) * 200 * intensity;
      const y = (Math.random() - 0.5) * 100 * intensity;
      setButtonOffset({ x, y });
      // Random snap-back delay (400-800ms)
      const snapDelay = 400 + Math.random() * 400;
      setTimeout(() => setButtonOffset({ x: 0, y: 0 }), snapDelay);
      return;
    }

    if (hasButtonPrank && dodgeCountRef.current === maxDodgesRef.current) {
      dodgeCountRef.current++;
      setButtonOffset({ x: 0, y: 0 });
      setShowFoolsToast(true);
      setShowConfetti(true);
      setTimeout(() => {
        setShowFoolsToast(false);
        navigate('/logs/create');
      }, 2000);
      return;
    }

    navigate('/logs/create');
  };

  // Transform data for multi-select
  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects]
  );

  const userOptions = useMemo(
    () => users.map((user) => ({ value: user.id, label: user.name })),
    [users]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Log</h1>
        <Button
          onClick={handleNewLog}
          style={hasButtonPrank ? {
            transform: `translate(${buttonOffset.x}px, ${buttonOffset.y}px)`,
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          } : undefined}
        >
          <IconPlus className="size-4 mr-2" />
          New Log
        </Button>
      </div>

      {/* Seasonal event confetti */}
      {showConfetti && <ConfettiEffect />}

      {/* Seasonal event toast */}
      {showFoolsToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-background border rounded-2xl shadow-2xl px-8 py-6 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-lg font-bold">Happy {seasonalEvent?.name}!</p>
          <p className="text-sm text-muted-foreground">Gotcha! Redirecting you now...</p>
        </div>
      )}

      <ProjectProgressSummary projects={projects} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            // Admin filters with multi-select
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DateRangePicker
                label="Date Range"
                value={dateRange}
                onChange={setDateRange}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Team</label>
                <Select
                  value={adminTeamId?.toString() || ''}
                  onValueChange={(val) => handleAdminTeamChange(val ? parseInt(val, 10) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MultiSelect
                label="Projects"
                placeholder="All projects"
                options={projectOptions}
                value={selectedProjectIds}
                onChange={setSelectedProjectIds}
                loading={projectsLoading}
              />
              <MultiSelect
                label="Team Members"
                placeholder="All members"
                options={userOptions}
                value={selectedUserIds}
                onChange={setSelectedUserIds}
                loading={usersLoading}
              />
            </div>
          ) : (
            // Member filters with single-select
            <div className="grid grid-cols-2 gap-4">
              <DateRangePicker
                label="Date Range"
                value={dateRange}
                onChange={setDateRange}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Project</label>
                <Select
                  value={selectedProjectId?.toString() || 'all'}
                  onValueChange={(value) =>
                    setSelectedProjectId(value === 'all' ? null : parseInt(value, 10))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LogsDataTable
        logs={filteredLogs}
        projects={projects}
        users={users}
        isAdmin={isAdmin}
        isLoading={logsLoading || projectsLoading}
      />
    </div>
  );
}
